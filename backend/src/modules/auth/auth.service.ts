import { Kysely } from 'kysely';
import { Database } from '../../db/schema.js';
import { RegisterInput, LoginInput, AuthenticatedUser } from '@devspace/shared';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { createSession, revokeSession } from '../../security/session.js';

export class AuthService {
  constructor(private db: Kysely<Database>) {}

  async register(
    input: RegisterInput,
    userAgent?: string | null,
    ipAddress?: string | null
  ): Promise<{ user: AuthenticatedUser; sessionToken: string }> {
    // 1. Check for duplicate email
    const existingEmail = await this.db
      .selectFrom('users')
      .select('id')
      .where('email', '=', input.email)
      .executeTakeFirst();

    if (existingEmail) {
      const err = new Error('Email is already registered');
      (err as any).statusCode = 409;
      (err as any).code = 'EMAIL_ALREADY_EXISTS';
      throw err;
    }

    // 2. Check for duplicate username
    const existingUsername = await this.db
      .selectFrom('profiles')
      .select('user_id')
      .where('username', '=', input.username)
      .executeTakeFirst();

    if (existingUsername) {
      const err = new Error('Username is already taken');
      (err as any).statusCode = 409;
      (err as any).code = 'USERNAME_ALREADY_TAKEN';
      throw err;
    }

    // 3. Hash password with memory-hard scrypt
    const passwordHash = await hashPassword(input.password);

    // 4. Create user and profile in a transaction
    const userRecord = await this.db.transaction().execute(async (trx) => {
      const [user] = await trx
        .insertInto('users')
        .values({
          email: input.email,
          password_hash: passwordHash,
          role: 'user',
          status: 'active',
        })
        .returning(['id', 'email', 'role', 'status'])
        .execute();

      await trx
        .insertInto('profiles')
        .values({
          user_id: user.id,
          username: input.username,
          display_name: input.displayName,
          bio: null,
          avatar_url: null,
          cover_url: null,
          github_url: null,
          website_url: null,
        })
        .execute();

      return user;
    });

    // 5. Create active session
    const session = await createSession(this.db, userRecord.id, userAgent, ipAddress);

    const authenticatedUser: AuthenticatedUser = {
      id: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      username: input.username,
      displayName: input.displayName,
      avatarUrl: null,
    };

    return { user: authenticatedUser, sessionToken: session.token };
  }

  async login(
    input: LoginInput,
    userAgent?: string | null,
    ipAddress?: string | null
  ): Promise<{ user: AuthenticatedUser; sessionToken: string }> {
    // 1. Fetch user by email
    const user = await this.db
      .selectFrom('users')
      .innerJoin('profiles', 'users.id', 'profiles.user_id')
      .select([
        'users.id',
        'users.email',
        'users.password_hash',
        'users.role',
        'users.status',
        'profiles.username',
        'profiles.display_name',
        'profiles.avatar_url',
      ])
      .where('users.email', '=', input.email)
      .executeTakeFirst();

    if (!user) {
      const err = new Error('Invalid email or password');
      (err as any).statusCode = 401;
      (err as any).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    if (user.status !== 'active') {
      const err = new Error('Account is suspended or deactivated');
      (err as any).statusCode = 403;
      (err as any).code = 'ACCOUNT_INACTIVE';
      throw err;
    }

    // 2. Verify password with constant-time scrypt verification
    const isValid = await verifyPassword(input.password, user.password_hash);
    if (!isValid) {
      const err = new Error('Invalid email or password');
      (err as any).statusCode = 401;
      (err as any).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // 3. Create active session
    const session = await createSession(this.db, user.id, userAgent, ipAddress);

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    };

    return { user: authenticatedUser, sessionToken: session.token };
  }

  async logout(sessionToken: string): Promise<void> {
    await revokeSession(this.db, sessionToken);
  }

  async getMe(userId: string): Promise<AuthenticatedUser | null> {
    const result = await this.db
      .selectFrom('users')
      .innerJoin('profiles', 'users.id', 'profiles.user_id')
      .select([
        'users.id',
        'users.email',
        'users.role',
        'profiles.username',
        'profiles.display_name',
        'profiles.avatar_url',
      ])
      .where('users.id', '=', userId)
      .where('users.status', '=', 'active')
      .executeTakeFirst();

    if (!result) return null;

    return {
      id: result.id,
      email: result.email,
      role: result.role,
      username: result.username,
      displayName: result.display_name,
      avatarUrl: result.avatar_url,
    };
  }
}
