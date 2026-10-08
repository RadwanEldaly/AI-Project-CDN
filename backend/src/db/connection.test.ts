import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { initDatabase, closeDatabase } from './connection.js';

test('Database Initialization & Constraints Validation', async (t) => {
  const testDir = path.resolve(process.cwd(), '.data', 'test-pglite-' + Date.now());

  await t.test('initializes and applies migrations successfully', async () => {
    const db = await initDatabase({ dataDir: testDir });
    assert.ok(db, 'Kysely instance should be returned');

    // Verify tables exist
    const userRes = await db.selectFrom('users').selectAll().execute();
    assert.deepEqual(userRes, [], 'Users table should exist and be empty');
  });

  await t.test('enforces Likes XOR constraint (chk_like_target)', async () => {
    const db = await initDatabase({ dataDir: testDir });

    // Create a test user
    const [user] = await db
      .insertInto('users')
      .values({
        email: 'test@example.com',
        password_hash: 'hash123',
        role: 'user',
        status: 'active',
      })
      .returning('id')
      .execute();

    assert.ok(user.id);

    // Create a test post
    const [post] = await db
      .insertInto('posts')
      .values({
        author_id: user.id,
        title: 'Test Post Title',
        content: 'Test content here',
      })
      .returning('id')
      .execute();

    // Valid: Post like (post_id IS NOT NULL, comment_id IS NULL)
    await assert.doesNotReject(async () => {
      await db
        .insertInto('likes')
        .values({
          user_id: user.id,
          post_id: post.id,
          comment_id: null,
        })
        .execute();
    }, 'Liking a post should succeed');

    // Invalid: Neither post nor comment (both NULL) -> should violate chk_like_target
    await assert.rejects(async () => {
      await db
        .insertInto('likes')
        .values({
          user_id: user.id,
          post_id: null,
          comment_id: null,
        })
        .execute();
    }, /chk_like_target/, 'Liking neither should be rejected by database constraint');

    // Invalid: Duplicate like (violates uq_likes_user_post)
    await assert.rejects(async () => {
      await db
        .insertInto('likes')
        .values({
          user_id: user.id,
          post_id: post.id,
          comment_id: null,
        })
        .execute();
    }, 'Duplicate like should be rejected by unique index');
  });

  // Teardown
  await closeDatabase();
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
