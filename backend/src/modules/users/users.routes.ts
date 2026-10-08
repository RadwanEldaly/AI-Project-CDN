import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { UpdateProfileSchema } from '@devspace/shared';
import { UsersService } from './users.service.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../security/middleware.js';

export const usersRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const usersService = new UsersService(getDb());

  // 1. GET /:username
  server.get('/:username', async (request, reply) => {
    const { username } = request.params as { username: string };
    const viewerId = request.currentUser?.id;

    const profile = await usersService.getProfileByUsername(username, viewerId);
    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User profile not found' },
      });
    }

    return reply.status(200).send({
      success: true,
      data: profile,
    });
  });

  // 1.5 GET /:username/posts
  server.get('/:username/posts', async (request, reply) => {
    const { username } = request.params as { username: string };
    const viewerId = request.currentUser?.id;

    const { PostsService } = await import('../posts/posts.service.js');
    const postsService = new PostsService(getDb());
    const posts = await postsService.getPostsByUsername(username, viewerId);

    return reply.status(200).send({
      success: true,
      data: posts,
    });
  });

  // 2. PATCH /me/profile
  server.patch('/me/profile', { preHandler: [requireAuth] }, async (request, reply) => {
    const parseResult = UpdateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Profile validation failed',
          details: parseResult.error.issues.map((i) => ({
            field: i.path.join('.'),
            issue: i.message,
          })),
        },
      });
    }

    const updated = await usersService.updateProfile(request.currentUser!.id, parseResult.data);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  });
};
