import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RequestUploadUrlSchema, ConfirmUploadSchema } from '@devspace/shared';
import { MediaService } from './media.service.js';
import { LocalStorageProvider } from './storage.service.js';
import { mediaQueue } from '../../queue/job-queue.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../security/middleware.js';

export const mediaRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const storage = new LocalStorageProvider();
  const mediaService = new MediaService(getDb(), storage, mediaQueue);


  // Register the background queue worker
  mediaQueue.registerWorker((job) => mediaService.processMediaJob(job));

  // 1. POST /upload-url (Pre-signed URL request)
  server.post(
    '/upload-url',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const parseResult = RequestUploadUrlSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid upload request payload',
            details: parseResult.error.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
          },
        });
      }

      const user = request.currentUser!;
      const result = await mediaService.requestUploadUrl(user.id, parseResult.data);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // 2. PUT /upload (Direct pre-signed binary upload simulation)
  server.put(
    '/upload',
    {
      // Add raw buffer parser for binary uploads
      bodyLimit: 52428800, // 50MB
    },
    async (request, reply) => {
      const { key, expires, sig } = request.query as {
        key?: string;
        expires?: string;
        sig?: string;
      };

      if (!key || !expires || !sig) {
        return reply.status(400).send({ error: 'Missing pre-signed parameters' });
      }

      const isValid = storage.verifyPresignedUploadUrl(
        key,
        parseInt(expires, 10),
        sig
      );

      if (!isValid) {
        return reply.status(403).send({ error: 'Expired or invalid upload signature' });
      }

      // Read binary buffer from request body
      const buffer = Buffer.isBuffer(request.body)
        ? request.body
        : typeof request.body === 'string'
        ? Buffer.from(request.body)
        : Buffer.from(JSON.stringify(request.body));

      await storage.saveRawUpload(key, buffer);

      // Persist raw binary in DB so it is immediately available across serverless lambdas
      try {
        const db = getDb();
        const mimeType = (request.headers['content-type'] as string) || 'application/octet-stream';
        await db
          .updateTable('post_media')
          .set({
            media_data: buffer.toString('base64'),
            mime_type: mimeType,
            byte_size: buffer.length,
          })
          .where('storage_key', '=', key)
          .execute();
      } catch (e) {
        server.log.error(e, 'Failed to save raw media buffer to DB');
      }

      return reply.status(200).send({ success: true, message: 'Upload received' });
    }
  );

  // 3. POST /confirm (Notify upload completed and trigger immediate processing)
  server.post(
    '/confirm',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parseResult = ConfirmUploadSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid confirmation payload',
          },
        });
      }

      const user = request.currentUser!;
      const result = await mediaService.confirmUpload(user.id, parseResult.data.mediaId);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // 4. GET /:id (Serve media image or video binary by ID)
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();
    const media = await db
      .selectFrom('post_media')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!media) {
      return reply.status(404).send({ success: false, error: 'Media not found' });
    }

    if (media.media_data) {
      const buffer = Buffer.from(media.media_data, 'base64');
      const contentType = media.mime_type || (media.media_type === 'video' ? 'video/mp4' : 'image/webp');
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.send(buffer);
    }

    if (media.optimized_url && media.optimized_url !== `/media/pending/${id}`) {
      return reply.redirect(media.optimized_url);
    }

    return reply.status(404).send({ success: false, error: 'Media binary not available' });
  });
};
