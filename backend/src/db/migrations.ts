import { Kysely, sql } from 'kysely';
import { Database } from './schema.js';

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  // 1. Users Table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
      status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  // 2. Profiles Table
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      username VARCHAR(32) NOT NULL UNIQUE,
      display_name VARCHAR(64) NOT NULL,
      bio TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      github_url VARCHAR(255),
      website_url VARCHAR(255),
      followers_count INT NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
      following_count INT NOT NULL DEFAULT 0 CHECK (following_count >= 0),
      posts_count INT NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$')
    );
  `.execute(db);

  // 3. Sessions Table
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      user_agent VARCHAR(512),
      ip_address INET,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);`.execute(db);

  // 4. Posts Table
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived', 'hidden')),
      likes_count INT NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
      comments_count INT NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
      search_vector TSVECTOR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts(author_id, created_at DESC) WHERE deleted_at IS NULL;`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC) WHERE deleted_at IS NULL AND status = 'published';`.execute(db);

  // 5. Post Media Table
  await sql`
    CREATE TABLE IF NOT EXISTS post_media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_type VARCHAR(16) NOT NULL CHECK (media_type IN ('image', 'video')),
      storage_key VARCHAR(512) NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      optimized_url TEXT,
      thumbnail_url TEXT,
      byte_size INT NOT NULL,
      width INT,
      height INT,
      duration_seconds INT,
      order_index INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id, order_index ASC);`.execute(db);

  // 6. Comments Table
  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      likes_count INT NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC) WHERE deleted_at IS NULL;`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;`.execute(db);

  // 7. Likes Table with Airtight Constraints
  await sql`
    CREATE TABLE IF NOT EXISTS likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_like_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
      )
    );
  `.execute(db);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_user_post ON likes(user_id, post_id) WHERE post_id IS NOT NULL;`.execute(db);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_user_comment ON likes(user_id, comment_id) WHERE comment_id IS NOT NULL;`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id) WHERE post_id IS NOT NULL;`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_likes_comment ON likes(comment_id) WHERE comment_id IS NOT NULL;`.execute(db);

  // 8. Follows Table
  await sql`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id),
      CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
    );
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id, follower_id);`.execute(db);

  // 9. Tags & Post Tags
  await sql`
    CREATE TABLE IF NOT EXISTS tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(32) NOT NULL UNIQUE,
      slug VARCHAR(32) NOT NULL UNIQUE,
      posts_count INT NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS post_tags (
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );
  `.execute(db);

  // 10. Notifications Table
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(32) NOT NULL CHECK (type IN ('post_liked', 'comment_added', 'user_followed', 'mention')),
      resource_id UUID NOT NULL,
      resource_type VARCHAR(32) NOT NULL CHECK (resource_type IN ('post', 'comment', 'user')),
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_notifs_recipient_read_created ON notifications(recipient_id, is_read, created_at DESC);`.execute(db);

  // 11. Audit Logs Table
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(64) NOT NULL,
      entity_type VARCHAR(32) NOT NULL,
      entity_id UUID NOT NULL,
      metadata JSONB,
      ip_address INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);`.execute(db);
}
