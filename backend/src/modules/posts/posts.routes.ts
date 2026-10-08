import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CreatePostSchema, UpdatePostSchema } from '@devspace/shared';
import { PostsService } from './posts.service.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../security/middleware.js';

export const postsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const postsService = new PostsService(getDb());

  // 1. POST / (Create post)
  server.post(
    '/',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      const parseResult = CreatePostSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid post payload',
            details: parseResult.error.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
          },
        });
      }

      const post = await postsService.createPost(
        request.currentUser!.id,
        parseResult.data
      );

      return reply.status(201).send({
        success: true,
        data: post,
      });
    }
  );

  // 2. GET /:id
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const viewerId = request.currentUser?.id;

    const post = await postsService.getPostById(id, viewerId);
    if (!post) {
      return reply.status(404).send({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
      });
    }

    return reply.status(200).send({
      success: true,
      data: post,
    });
  });

  // 3. PATCH /:id
  server.patch('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = UpdatePostSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Invalid update payload' },
      });
    }

    const updated = await postsService.updatePost(
      id,
      request.currentUser!.id,
      request.currentUser!.role,
      parseResult.data
    );

    return reply.status(200).send({
      success: true,
      data: updated,
    });
  });

  // 4. DELETE /:id
  server.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await postsService.deletePost(
      id,
      request.currentUser!.id,
      request.currentUser!.role
    );

    return reply.status(200).send({
      success: true,
      data: { message: 'Post deleted successfully' },
    });
  });
};
