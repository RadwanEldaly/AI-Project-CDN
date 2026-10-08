import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RegisterSchema, LoginSchema } from '@devspace/shared';
import { AuthService } from './auth.service.js';
import { getDb } from '../../db/connection.js';
import { setSessionCookie, clearSessionCookie } from '../../security/cookies.js';
import { requireAuth } from '../../security/middleware.js';

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const authService = new AuthService(getDb());

  const isProd = process.env.NODE_ENV === 'production';

  // 1. POST /register
  server.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: isProd ? 10 : 500,
          timeWindow: '1 hour',
        },
      },
    },
    async (request, reply) => {
      const parseResult = RegisterSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Input validation failed',
            details: parseResult.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              issue: issue.message,
            })),
          },
        });
      }

      try {
        const { user, sessionToken } = await authService.register(
          parseResult.data,
          request.headers['user-agent'],
          request.ip
        );

        setSessionCookie(reply, sessionToken);

        return reply.status(201).send({
          success: true,
          data: { user, token: sessionToken },
        });
      } catch (err: any) {
        const status = err.statusCode || 500;
        return reply.status(status).send({
          success: false,
          error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'An unexpected error occurred',
          },
        });
      }
    }
  );

  // 2. POST /login
  server.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: isProd ? 15 : 500,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = LoginSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid credentials format',
            details: parseResult.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              issue: issue.message,
            })),
          },
        });
      }

      try {
        const { user, sessionToken } = await authService.login(
          parseResult.data,
          request.headers['user-agent'],
          request.ip
        );

        setSessionCookie(reply, sessionToken);

        return reply.status(200).send({
          success: true,
          data: { user, token: sessionToken },
        });
      } catch (err: any) {
        const status = err.statusCode || 500;
        return reply.status(status).send({
          success: false,
          error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'An unexpected error occurred',
          },
        });
      }
    }
  );

  // 3. POST /logout
  server.post(
    '/logout',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (request.sessionToken) {
        await authService.logout(request.sessionToken);
      }
      clearSessionCookie(reply);
      return reply.status(200).send({
        success: true,
        data: { message: 'Successfully logged out' },
      });
    }
  );

  // 4. GET /me
  server.get(
    '/me',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      return reply.status(200).send({
        success: true,
        data: { user: request.currentUser },
      });
    }
  );
};
