import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from './security/middleware.js';
import { getDb, initDatabase } from './db/connection.js';
import { sql } from 'kysely';
import { authRoutes } from './modules/auth/auth.routes.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { postsRoutes } from './modules/posts/posts.routes.js';
import { interactionsRoutes } from './modules/interactions/interactions.routes.js';
import { feedRoutes } from './modules/feed/feed.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';

const __dirname = process.cwd();

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            remoteAddress: req.ip,
          };
        },
      },
    },
    trustProxy: true,
  });

  // 1. Security Headers (Helmet)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // Gracefully handle empty JSON body on POST/PUT requests
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // 2. CORS configuration
  await app.register(cors, {
    origin: (origin, cb) => {
      // In development, allow localhost; in production, validate explicit origin or vercel preview deployments
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.endsWith('.vercel.app')) {
        cb(null, true);
        return;
      }
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://devspace.app').split(',');
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // 3. Cookies
  await app.register(cookie);

  // 4. Rate Limiting
  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    allowList: (req) => {
      const url = req.url || '';
      return (
        url.startsWith('/assets') ||
        url === '/favicon.ico' ||
        url === '/healthz' ||
        url === '/readyz' ||
        url === '/' ||
        url === '/index.html'
      );
    },
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please retry in ${Math.ceil(context.ttl / 1000)} seconds.`,
      },
    }),
  });

  // 5. Global Authentication decorator
  app.addHook('preHandler', authenticate);

  // 6. Uniform Global Error Handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: statusCode === 500 ? 'An unexpected internal error occurred' : error.message,
      },
    });
  });

  // 7. Health & Readiness Probes
  app.get('/healthz', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  app.get('/readyz', async (_request, reply) => {
    try {
      const db = getDb();
      await sql`SELECT 1;`.execute(db);
      return {
        status: 'healthy',
        dependencies: {
          database: { status: 'healthy' },
        },
      };
    } catch (err: any) {
      reply.status(503).send({
        status: 'degraded',
        dependencies: {
          database: { status: 'down', error: err.message },
        },
      });
    }
  });

  // 8. Register Domain Routes under /api/v1
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(mediaRoutes, { prefix: '/api/v1/media' });
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(postsRoutes, { prefix: '/api/v1/posts' });
  await app.register(interactionsRoutes, { prefix: '/api/v1' });
  await app.register(feedRoutes, { prefix: '/api/v1/feed' });
  await app.register(searchRoutes, { prefix: '/api/v1/search' });
  await app.register(notificationsRoutes, { prefix: '/api/v1/notifications' });

  // 9. Static Media CDN Serving
  const storageBaseDir = path.resolve(process.cwd(), '.data', 'storage');
  const processedDir = path.join(storageBaseDir, 'processed');
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  await app.register(fastifyStatic, {
    root: processedDir,
    prefix: '/media-cdn/',
    decorateReply: false,
  });

  // 10. Static Frontend Serving (SPA fallback)
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
    });

    app.setNotFoundHandler((req, reply) => {
      const url = req.raw.url || '';
      if (url.startsWith('/api')) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API route not found' },
        });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}

let appInstance: FastifyInstance | null = null;
let isDbInitialized = false;

async function getOrInitApp(): Promise<FastifyInstance> {
  if (!isDbInitialized) {
    try {
      await initDatabase();
      isDbInitialized = true;
    } catch (err) {
      console.error('Failed to initialize database in serverless handler:', err);
    }
  }
  if (!appInstance) {
    appInstance = await buildApp();
    await appInstance.ready();
  }
  return appInstance;
}

export default async function handler(req: any, res: any) {
  const instance = await getOrInitApp();
  instance.server.emit('request', req, res);
}
