import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { buildApp } from '../../app.js';
import { initDatabase, closeDatabase, getDb } from '../../db/connection.js';

test('Media Upload & Background Processing Suite', async (t) => {
  const testDir = path.resolve(process.cwd(), '.data', 'test-media-' + Date.now());
  await initDatabase({ dataDir: testDir });
  const app = await buildApp();

  let sessionCookie: string = '';

  // Setup: Register and authenticate user
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: 'mediauser@example.com',
      username: 'media_tester',
      displayName: 'Media Tester',
      password: 'Password123!',
    },
  });
  const setCookie = regRes.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);

  await t.test('1. Requests pre-signed upload URL for valid image', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { cookie: sessionCookie },
      payload: {
        filename: 'architecture.png',
        mimeType: 'image/png',
        byteSize: 1024,
        purpose: 'post_attachment',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(body.data.mediaId);
    assert.ok(body.data.uploadUrl);
    assert.match(body.data.uploadUrl, /key=/);
    assert.match(body.data.uploadUrl, /sig=/);

    // 2. Perform direct binary upload with valid PNG magic bytes
    const pngMagicBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const uploadRes = await app.inject({
      method: 'PUT',
      url: body.data.uploadUrl,
      headers: { 'content-type': 'image/png' },
      payload: pngMagicBuffer,
    });
    assert.equal(uploadRes.statusCode, 200);

    // 3. Confirm upload
    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/confirm',
      headers: { cookie: sessionCookie },
      payload: { mediaId: body.data.mediaId },
    });
    assert.equal(confirmRes.statusCode, 202);

    // Wait a brief tick for background worker processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 4. Verify database record is marked 'ready'
    const db = getDb();
    const media = await db
      .selectFrom('post_media')
      .selectAll()
      .where('id', '=', body.data.mediaId)
      .executeTakeFirst();

    assert.ok(media);
    assert.equal(media.status, 'ready');
    assert.ok(media.optimized_url);
    assert.ok(media.thumbnail_url);
  });

  await t.test('2. Worker rejects spoofed upload with invalid magic bytes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { cookie: sessionCookie },
      payload: {
        filename: 'malicious.png',
        mimeType: 'image/png',
        byteSize: 512,
        purpose: 'post_attachment',
      },
    });

    const body = JSON.parse(res.body);

    // Upload spoofed executable binary (MZ header: 4D 5A)
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    await app.inject({
      method: 'PUT',
      url: body.data.uploadUrl,
      headers: { 'content-type': 'image/png' },
      payload: exeBuffer,
    });

    // Confirm upload
    await app.inject({
      method: 'POST',
      url: '/api/v1/media/confirm',
      headers: { cookie: sessionCookie },
      payload: { mediaId: body.data.mediaId },
    });

    // Wait for worker
    await new Promise((resolve) => setTimeout(resolve, 100));

    const db = getDb();
    const media = await db
      .selectFrom('post_media')
      .selectAll()
      .where('id', '=', body.data.mediaId)
      .executeTakeFirst();

    assert.ok(media);
    assert.equal(media.status, 'rejected', 'Spoofed file should be rejected by magic bytes check');
  });

  // Teardown
  await app.close();
  await closeDatabase();
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
