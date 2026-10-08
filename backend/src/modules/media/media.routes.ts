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

  // Register binary content parser for direct S3-style PUT uploads
  server.addContentTypeParser(
    [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/octet-stream',
    ],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

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
        : Buffer.from(JSON.stringify(request.body));

      await storage.saveRawUpload(key, buffer);

      return reply.status(200).send({ success: true, message: 'Upload received' });
    }
  );

  // 3. POST /confirm (Notify upload completed and trigger processing)
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

      return reply.status(202).send({
        success: true,
        data: result,
      });
    }
  );
};
