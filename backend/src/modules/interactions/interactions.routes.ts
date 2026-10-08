import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CreateCommentSchema } from '@devspace/shared';
import { InteractionsService } from './interactions.service.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../security/middleware.js';

export const interactionsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const interactionsService = new InteractionsService(getDb());

  // 1. POST /posts/:id/like
  server.post('/posts/:id/like', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await interactionsService.likePost(request.currentUser!.id, id);
    return reply.status(200).send({ success: true, data: result });
  });

  // 2. DELETE /posts/:id/like
  server.delete('/posts/:id/like', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await interactionsService.unlikePost(request.currentUser!.id, id);
    return reply.status(200).send({ success: true, data: result });
  });

  // 3. POST /posts/:id/comments
  server.post('/posts/:id/comments', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = CreateCommentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Invalid comment payload' },
      });
    }

    const comment = await interactionsService.createComment(
      request.currentUser!.id,
      id,
      parseResult.data
    );
    return reply.status(201).send({ success: true, data: comment });
  });

  // 4. GET /posts/:id/comments
  server.get('/posts/:id/comments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const comments = await interactionsService.getPostComments(id, request.currentUser?.id);
    return reply.status(200).send({ success: true, data: comments });
  });

  // 5. POST /users/:id/follow
  server.post('/users/:id/follow', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await interactionsService.followUser(request.currentUser!.id, id);
    return reply.status(200).send({ success: true, data: result });
  });

  // 6. DELETE /users/:id/follow
  server.delete('/users/:id/follow', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await interactionsService.unfollowUser(request.currentUser!.id, id);
    return reply.status(200).send({ success: true, data: result });
  });
};
