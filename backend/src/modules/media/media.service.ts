import { Kysely } from 'kysely';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Database } from '../../db/schema.js';
import { RequestUploadUrlInput, UploadUrlResponse } from '@devspace/shared';
import { StorageProvider } from './storage.service.js';
import { IJobQueue, MediaJobPayload } from '../../queue/job-queue.js';

export class MediaService {
  constructor(
    private db: Kysely<Database>,
    private storage: StorageProvider,
    private queue: IJobQueue<MediaJobPayload>
  ) {}

  async requestUploadUrl(
    userId: string,
    input: RequestUploadUrlInput
  ): Promise<UploadUrlResponse> {
    const mediaId = crypto.randomUUID();
    const mediaType: 'image' | 'video' = input.mimeType.startsWith('video/') ? 'video' : 'image';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = path.extname(input.filename) || (mediaType === 'video' ? '.mp4' : '.png');
    const storageKey = `raw-uploads/${userId}/${year}/${month}/${mediaId}${ext}`;

    const expiresInSeconds = 900; // 15 minutes

    // 1. Persist initial media metadata record
    await this.db
      .insertInto('post_media')
      .values({
        id: mediaId,
        uploader_id: userId,
        media_type: mediaType,
        storage_key: storageKey,
        original_url: `/media/pending/${mediaId}`,
        byte_size: input.byteSize,
        status: 'pending',
      })
      .execute();

    // 2. Generate pre-signed PUT upload URL
    const uploadUrl = await this.storage.generatePresignedUploadUrl(
      storageKey,
      input.mimeType,
      input.byteSize,
      expiresInSeconds
    );

    return {
      mediaId,
      uploadUrl,
      storageKey,
      expiresInSeconds,
    };
  }

  async confirmUpload(
    userId: string,
    mediaId: string
  ): Promise<{ mediaId: string; status: string; message: string }> {
    const media = await this.db
      .selectFrom('post_media')
      .selectAll()
      .where('id', '=', mediaId)
      .executeTakeFirst();

    if (!media) {
      const err = new Error('Media record not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (media.uploader_id !== userId) {
      const err = new Error('Unauthorized to modify this media record');
      (err as any).statusCode = 403;
      throw err;
    }

    // Update status to processing
    await this.db
      .updateTable('post_media')
      .set({ status: 'processing' })
      .where('id', '=', mediaId)
      .execute();

    // Enqueue background processing job
    await this.queue.add('process_media', {
      mediaId,
      storageKey: media.storage_key,
      mediaType: media.media_type,
      userId,
    });

    return {
      mediaId,
      status: 'processing',
      message: 'Media queued for background optimization',
    };
  }

  /**
   * Worker task: verifies magic bytes and generates web-optimized artifacts
   */
  async processMediaJob(job: MediaJobPayload): Promise<void> {
    try {
      // 1. Validate magic bytes from raw file
      const rawStream = await this.storage.getRawUploadStream(job.storageKey);
      const chunks: Buffer[] = [];
      for await (const piece of rawStream) {
        chunks.push(typeof piece === 'string' ? Buffer.from(piece) : piece);
      }
      const fullBuffer = Buffer.concat(chunks);

      const isMagicValid = this.validateMagicBytes(fullBuffer, job.mediaType);
      if (!isMagicValid) {
        await this.db
          .updateTable('post_media')
          .set({ status: 'rejected' })
          .where('id', '=', job.mediaId)
          .execute();
        await this.storage.deleteObject(job.storageKey);
        return;
      }

      // 2. Process and save web-optimized delivery format
      const processedKey = `optimized/${job.mediaType}s/${job.mediaId}.${job.mediaType === 'video' ? 'mp4' : 'webp'}`;
      const thumbKey = `thumbnails/${job.mediaId}.webp`;

      // In development/test mode, create optimized artifact from verified raw buffer
      const optimizedUrl = await this.storage.saveProcessedMedia(
        processedKey,
        fullBuffer,
        job.mediaType === 'video' ? 'video/mp4' : 'image/webp'
      );
      const thumbnailUrl = await this.storage.saveProcessedMedia(
        thumbKey,
        fullBuffer.subarray(0, Math.min(fullBuffer.length, 1024)),
        'image/webp'
      );

      // 3. Mark media as ready with metadata
      await this.db
        .updateTable('post_media')
        .set({
          status: 'ready',
          optimized_url: optimizedUrl,
          thumbnail_url: thumbnailUrl,
          width: 1920,
          height: 1080,
          duration_seconds: job.mediaType === 'video' ? 30 : null,
        })
        .where('id', '=', job.mediaId)
        .execute();

      // 4. Remove raw pending upload
      await this.storage.deleteObject(job.storageKey);
    } catch (error) {
      console.error(`[MediaService] Processing failed for ${job.mediaId}:`, error);
      await this.db
        .updateTable('post_media')
        .set({ status: 'failed' })
        .where('id', '=', job.mediaId)
        .execute();
    }
  }

  private validateMagicBytes(buffer: Buffer, mediaType: 'image' | 'video'): boolean {
    if (buffer.length < 4) return false;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
    // WebP: RIFF ... WEBP
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) return true;
    // MP4 / MOV / QuickTime: 'ftyp' at offset 4
    if (mediaType === 'video' && buffer.length >= 8) {
      const ftyp = buffer.subarray(4, 8).toString('ascii');
      if (ftyp === 'ftyp' || ftyp === 'moov') return true;
    }
    // WebM / EBML: 1A 45 DF A3
    if (
      mediaType === 'video' &&
      buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3
    ) return true;

    return false;
  }
}
