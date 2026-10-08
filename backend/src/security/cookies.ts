import { FastifyReply, FastifyRequest } from 'fastify';

export const SESSION_COOKIE_NAME = 'devspace_session';

export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  };
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, getCookieOptions());
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

export function getSessionTokenFromRequest(request: FastifyRequest): string | null {
  // Check cookie first
  const cookieToken = request.cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  // Fallback to Authorization: Bearer <token> for API testing and clients
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}
