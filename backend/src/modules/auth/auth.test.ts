import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { buildApp } from '../../app.js';
import { initDatabase, closeDatabase } from '../../db/connection.js';

test('Authentication Flow Integration Suite', async (t) => {
  const testDir = path.resolve(process.cwd(), '.data', 'test-auth-' + Date.now());
  await initDatabase({ dataDir: testDir });
  const app = await buildApp();

  let sessionCookie: string = '';

  await t.test('1. Registers a new user successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'alex@example.com',
        username: 'alex_dev',
        displayName: 'Alex Developer',
        password: 'Password123!',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'alex@example.com');
    assert.equal(body.data.user.username, 'alex_dev');

    // Verify Set-Cookie header contains HttpOnly and SameSite=Lax
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Should set session cookie');
    sessionCookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);
    assert.match(sessionCookie, /devspace_session=/);
    assert.match(sessionCookie, /HttpOnly/i);
  });

  await t.test('2. Rejects registration with duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'alex@example.com',
        username: 'different_user',
        displayName: 'Different Name',
        password: 'Password123!',
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  await t.test('3. Rejects registration with weak password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'bob@example.com',
        username: 'bob_dev',
        displayName: 'Bob Developer',
        password: 'short',
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_FAILED');
  });

  await t.test('4. Logs in with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'alex@example.com',
        password: 'Password123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.user.username, 'alex_dev');

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie);
    sessionCookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);
  });

  await t.test('5. Rejects login with invalid password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'alex@example.com',
        password: 'WrongPassword999!',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
  });

  await t.test('6. Verifies /me returns authenticated profile with session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: sessionCookie,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.user.username, 'alex_dev');
  });

  await t.test('7. Logs out and revokes session', async () => {
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: sessionCookie,
      },
    });

    assert.equal(logoutRes.statusCode, 200);

    // /me should now return 401 Unauthorized
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: sessionCookie,
      },
    });

    assert.equal(meRes.statusCode, 401);
  });

  // Teardown
  await app.close();
  await closeDatabase();
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
