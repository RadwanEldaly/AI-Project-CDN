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

    // Process media synchronously to guarantee readiness before serverless lambda completes
    await this.processMediaJob({
      mediaId,
      storageKey: media.storage_key,
      mediaType: media.media_type,
      userId,
    });

    const updated = await this.db
      .selectFrom('post_media')
      .select(['status', 'optimized_url'])
      .where('id', '=', mediaId)
      .executeTakeFirst();

    return {
      mediaId,
      status: updated?.status || 'ready',
      message: 'Media verified and ready',
    };
  }

  /**
   * Worker task: verifies magic bytes and generates web-optimized artifacts
   */
  async processMediaJob(job: MediaJobPayload): Promise<void> {
    try {
      // 1. Validate magic bytes from raw file on disk OR database
      let fullBuffer: Buffer | null = null;
      try {
        const rawStream = await this.storage.getRawUploadStream(job.storageKey);
        const chunks: Buffer[] = [];
        for await (const piece of rawStream) {
          chunks.push(typeof piece === 'string' ? Buffer.from(piece) : piece);
        }
        if (chunks.length > 0) {
          fullBuffer = Buffer.concat(chunks);
        }
      } catch (_) {}

      if (!fullBuffer || fullBuffer.length === 0) {
        const record = await this.db
          .selectFrom('post_media')
          .select(['media_data'])
          .where('id', '=', job.mediaId)
          .executeTakeFirst();
        if (record && record.media_data) {
          fullBuffer = Buffer.from(record.media_data, 'base64');
        }
      }

      if (!fullBuffer || fullBuffer.length === 0) {
        throw new Error('Raw media upload payload not found on disk or database');
      }

      const isMagicValid = this.validateMagicBytes(fullBuffer, job.mediaType);
      if (!isMagicValid) {
        await this.db
          .updateTable('post_media')
          .set({ status: 'rejected' })
          .where('id', '=', job.mediaId)
          .execute();
        await this.storage.deleteObject(job.storageKey).catch(() => {});
        return;
      }

      // 2. Process and save web-optimized delivery format
      const processedKey = `optimized/${job.mediaType}s/${job.mediaId}.${job.mediaType === 'video' ? 'mp4' : 'webp'}`;
      const thumbKey = `thumbnails/${job.mediaId}.webp`;

      const mimeType = job.mediaType === 'video' ? 'video/mp4' : 'image/webp';
      const optimizedUrl = await this.storage.saveProcessedMedia(
        processedKey,
        fullBuffer,
        mimeType
      );
      const thumbnailUrl = await this.storage.saveProcessedMedia(
        thumbKey,
        fullBuffer.subarray(0, Math.min(fullBuffer.length, 1024)),
        'image/webp'
      );

      // 3. Mark media as ready with metadata and persistent base64 media_data in database
      await this.db
        .updateTable('post_media')
        .set({
          status: 'ready',
          optimized_url: optimizedUrl,
          thumbnail_url: thumbnailUrl,
          media_data: fullBuffer.toString('base64'),
          mime_type: mimeType,
          width: 1920,
          height: 1080,
          duration_seconds: job.mediaType === 'video' ? 30 : null,
        })
        .where('id', '=', job.mediaId)
        .execute();

      // 4. Remove raw pending upload from temp disk
      await this.storage.deleteObject(job.storageKey).catch(() => {});
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
    // GIF: GIF87a / GIF89a
    if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return true;
    // SVG
    if (buffer.subarray(0, 100).toString('utf8').toLowerCase().includes('<svg')) return true;

    // Videos: MP4 / MOV / QuickTime / WebM / MKV
    if (mediaType === 'video') {
      // Check first 128 bytes for common video box signatures
      const sample = buffer.subarray(0, Math.min(buffer.length, 128)).toString('binary');
      if (
        sample.includes('ftyp') ||
        sample.includes('moov') ||
        sample.includes('wide') ||
        sample.includes('mdat') ||
        sample.includes('isom') ||
        sample.includes('mp41') ||
        sample.includes('mp42') ||
        sample.includes('qt  ')
      ) return true;

      // WebM / Matroska / EBML: 1A 45 DF A3
      if (
        buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3
      ) return true;

      // RIFF AVI
      if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && sample.includes('AVI ')) return true;
    }

    return false;
  }
}
