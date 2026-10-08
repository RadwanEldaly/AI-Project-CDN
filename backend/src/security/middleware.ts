import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthenticatedUser } from '@devspace/shared';
import { getDb } from '../db/connection.js';
import { getSessionTokenFromRequest } from './cookies.js';
import { validateSessionToken } from './session.js';

// Extend FastifyRequest interface to include currentUser
declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
    sessionToken?: string;
  }
}

/**
 * Authentication decorator: parses session cookie, validates in DB, and attaches currentUser
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return;
  }

  try {
    const db = getDb();
    const user = await validateSessionToken(db, token);
    if (user) {
      request.currentUser = user;
      request.sessionToken = token;
    }
  } catch (error) {
    request.log.warn({ err: error }, 'Failed to validate session token');
  }
}

/**
 * Guard: Requires user to be authenticated
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.currentUser) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access this resource',
      },
    });
  }
}

/**
 * Guard: Requires user to hold one of the specified roles
 */
export function requireRole(allowedRoles: Array<'moderator' | 'admin'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.currentUser) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!allowedRoles.includes(request.currentUser.role as 'moderator' | 'admin')) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions for this operation',
        },
      });
    }
  };
}
