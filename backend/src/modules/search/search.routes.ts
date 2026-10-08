import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SearchService } from './search.service.js';
import { getDb } from '../../db/connection.js';

export const searchRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const searchService = new SearchService(getDb());

  server.get('/', async (request, reply) => {
    const { q, type, limit } = request.query as {
      q?: string;
      type?: 'posts' | 'users';
      limit?: string;
    };

    if (!q || q.trim().length < 2) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Search query must be at least 2 characters' },
      });
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const searchType = type || 'posts';

    if (searchType === 'users') {
      const results = await searchService.searchUsers(q, parsedLimit);
      return reply.status(200).send({ success: true, data: results });
    } else {
      const results = await searchService.searchPosts(q, parsedLimit);
      return reply.status(200).send({ success: true, data: results });
    }
  });
};
