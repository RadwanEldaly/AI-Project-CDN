import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { FeedService } from './feed.service.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../security/middleware.js';

export const feedRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const feedService = new FeedService(getDb());

  // 1. GET / (Following Feed)
  server.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const { cursor, limit } = request.query as {
      cursor?: string;
      limit?: string;
    };

    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const result = await feedService.getFollowingFeed(
      request.currentUser!.id,
      cursor,
      parsedLimit
    );

    return reply.status(200).send({
      success: true,
      data: result.posts,
      meta: {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  });

  // 2. GET /explore (Public Discovery Feed)
  server.get('/explore', async (request, reply) => {
    const { cursor, limit, tag } = request.query as {
      cursor?: string;
      limit?: string;
      tag?: string;
    };

    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const viewerId = request.currentUser?.id;
    const result = await feedService.getExploreFeed(
      cursor,
      parsedLimit,
      tag,
      viewerId
    );

    return reply.status(200).send({
      success: true,
      data: result.posts,
      meta: {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  });
};
