import crypto from 'crypto';
import { Kysely } from 'kysely';
import { Database } from '../db/schema.js';
import { AuthenticatedUser } from '@devspace/shared';

const SESSION_DURATION_DAYS = 30;

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Kysely<Database>,
  userId: string,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db
    .insertInto('sessions')
    .values({
      user_id: userId,
      token_hash: tokenHash,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      expires_at: expiresAt.toISOString(),
    })
    .execute();

  return { token, expiresAt };
}

export async function validateSessionToken(
  db: Kysely<Database>,
  token: string
): Promise<AuthenticatedUser | null> {
  const tokenHash = hashSessionToken(token);
  const now = new Date().toISOString();

  const result = await db
    .selectFrom('sessions')
    .innerJoin('users', 'sessions.user_id', 'users.id')
    .innerJoin('profiles', 'users.id', 'profiles.user_id')
    .select([
      'users.id',
      'users.email',
      'users.role',
      'users.status',
      'profiles.username',
      'profiles.display_name',
      'profiles.avatar_url',
      'sessions.expires_at',
    ])
    .where('sessions.token_hash', '=', tokenHash)
    .where('sessions.expires_at', '>', now)
    .where('users.status', '=', 'active')
    .executeTakeFirst();

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    email: result.email,
    role: result.role,
    username: result.username,
    displayName: result.display_name,
    avatarUrl: result.avatar_url,
  };
}

export async function revokeSession(
  db: Kysely<Database>,
  token: string
): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await db
    .deleteFrom('sessions')
    .where('token_hash', '=', tokenHash)
    .execute();
}
