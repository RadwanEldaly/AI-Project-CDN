import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { NotificationsService } from './notifications.service.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../security/middleware.js';

export const notificationsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const notificationsService = new NotificationsService(getDb());

  // 1. GET / (Inbox)
  server.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    const notifs = await notificationsService.getUserNotifications(
      request.currentUser!.id,
      parsedLimit
    );
    return reply.status(200).send({ success: true, data: notifs });
  });

  // 2. GET /unread-count
  server.get('/unread-count', { preHandler: [requireAuth] }, async (request, reply) => {
    const count = await notificationsService.getUnreadCount(request.currentUser!.id);
    return reply.status(200).send({ success: true, data: { unreadCount: count } });
  });

  // 3. PATCH /mark-read
  server.patch('/mark-read', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = (request.body as { notificationIds?: string[] }) || {};
    const result = await notificationsService.markRead(
      request.currentUser!.id,
      body.notificationIds
    );
    return reply.status(200).send({ success: true, data: result });
  });
};
