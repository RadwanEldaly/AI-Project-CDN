import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { buildApp } from '../../app.js';
import { initDatabase, closeDatabase } from '../../db/connection.js';

test('End-to-End Social Community Lifecycle Suite', async (t) => {
  const testDir = path.resolve(process.cwd(), '.data', 'test-social-' + Date.now());
  await initDatabase({ dataDir: testDir });
  const app = await buildApp();

  let userACookie = '';
  let userBCookie = '';
  let userAId = '';
  let userBId = '';
  let createdPostId = '';

  await t.test('1. Setup two registered users (Alice & Bob)', async () => {
    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'alice@example.com',
        username: 'alice_arch',
        displayName: 'Alice Architect',
        password: 'Password123!',
      },
    });
    assert.equal(resA.statusCode, 201);
    const bodyA = JSON.parse(resA.body);
    userAId = bodyA.data.user.id;
    const cookieA = resA.headers['set-cookie'];
    userACookie = Array.isArray(cookieA) ? cookieA[0] : (cookieA as string);

    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'bob@example.com',
        username: 'bob_builder',
        displayName: 'Bob Builder',
        password: 'Password123!',
      },
    });
    assert.equal(resB.statusCode, 201);
    const bodyB = JSON.parse(resB.body);
    userBId = bodyB.data.user.id;
    const cookieB = resB.headers['set-cookie'];
    userBCookie = Array.isArray(cookieB) ? cookieB[0] : (cookieB as string);
  });

  await t.test('2. Alice updates profile bio and tech stack info', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/profile',
      headers: { cookie: userACookie },
      payload: {
        bio: 'Distributed systems engineer and Postgres enthusiast',
        githubUrl: 'https://github.com/alice',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.bio, 'Distributed systems engineer and Postgres enthusiast');
  });

  await t.test('3. Alice publishes a technical post with Markdown and tags', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { cookie: userACookie },
      payload: {
        title: 'Deep Dive into B-Tree Indexes in PostgreSQL',
        content: '# B-Trees Explained\n\nHere is how composite indexes eliminate N+1 queries:\n\n```sql\nSELECT * FROM posts WHERE id = 1;\n```',
        tags: ['postgres', 'database', 'performance'],
      },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.data.id);
    createdPostId = body.data.id;
    assert.equal(body.data.author.username, 'alice_arch');
    assert.deepEqual(body.data.tags, ['postgres', 'database', 'performance']);
  });

  await t.test('4. Bob follows Alice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${userAId}/follow`,
      headers: { cookie: userBCookie },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.isFollowing, true);
    assert.equal(body.data.followersCount, 1);
  });

  await t.test('5. Bob views his personalized following feed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/feed',
      headers: { cookie: userBCookie },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, createdPostId);
    assert.equal(body.data[0].title, 'Deep Dive into B-Tree Indexes in PostgreSQL');
    assert.equal(body.data[0].isLiked, false);
  });

  await t.test('6. Bob likes Alice post idempotently', async () => {
    // First like
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${createdPostId}/like`,
      headers: { cookie: userBCookie },
    });
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.equal(body1.data.liked, true);
    assert.equal(body1.data.likesCount, 1);

    // Duplicate like attempt (should be idempotent)
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${createdPostId}/like`,
      headers: { cookie: userBCookie },
    });
    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.data.likesCount, 1, 'Likes count should not increase on duplicate like');
  });

  await t.test('7. Bob comments on Alice post', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${createdPostId}/comments`,
      headers: { cookie: userBCookie },
      payload: {
        content: 'Fantastic breakdown! What about GIN indexes for JSONB?',
      },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.data.author.username, 'bob_builder');
    assert.equal(body.data.content, 'Fantastic breakdown! What about GIN indexes for JSONB?');
  });

  await t.test('8. Alice receives notifications for follow, like, and comment', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { cookie: userACookie },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.data.length >= 3, 'Alice should have received at least 3 notifications');

    const types = body.data.map((n: any) => n.type);
    assert.ok(types.includes('user_followed'));
    assert.ok(types.includes('post_liked'));
    assert.ok(types.includes('comment_added'));

    // Check unread count
    const unreadRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { cookie: userACookie },
    });
    const unreadBody = JSON.parse(unreadRes.body);
    assert.ok(unreadBody.data.unreadCount >= 3);

    // Mark all read
    const markRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notifications/mark-read',
      headers: { cookie: userACookie },
      payload: {},
    });
    assert.equal(markRes.statusCode, 200);

    const postMarkRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { cookie: userACookie },
    });
    const postMarkBody = JSON.parse(postMarkRes.body);
    assert.equal(postMarkBody.data.unreadCount, 0);
  });

  await t.test('9. Full-text search for posts and users', async () => {
    // Search posts by keyword 'B-Tree'
    const postSearch = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=B-Tree&type=posts',
    });
    assert.equal(postSearch.statusCode, 200);
    const postBody = JSON.parse(postSearch.body);
    assert.ok(postBody.data.length >= 1);
    assert.equal(postBody.data[0].id, createdPostId);

    // Search users by username 'alice'
    const userSearch = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=alice&type=users',
    });
    assert.equal(userSearch.statusCode, 200);
    const userBody = JSON.parse(userSearch.body);
    assert.ok(userBody.data.length >= 1);
    assert.equal(userBody.data[0].username, 'alice_arch');
  });

  await t.test('10. Public Explore Feed with tag filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/explore?tag=postgres',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.data.length >= 1);
    assert.equal(body.data[0].id, createdPostId);
  });

  // Teardown
  await app.close();
  await closeDatabase();
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
