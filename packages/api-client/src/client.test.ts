import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { z } from 'zod';
import { ApiClientError, BudgetManagerClient } from './client.ts';

type Handler = (url: string, init: RequestInit | undefined) => Response;

const originalFetch = globalThis.fetch;
let calls: string[] = [];

function mockFetch(handler: Handler): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace('http://api', '');
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    return handler(url, init);
  }) as typeof fetch;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const userSchema = z.object({ email: z.string() });

describe('BudgetManagerClient session refresh', () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('refreshes once and retries after an expired access token', async () => {
    let refreshed = false;
    mockFetch((url) => {
      if (url === '/auth/refresh') {
        refreshed = true;
        return json(200, { message: 'Refreshed' });
      }
      return refreshed
        ? json(200, { email: 'me@example.com' })
        : json(401, { message: 'expired' });
    });

    const user = await new BudgetManagerClient('http://api').request(
      '/users/current',
      userSchema
    );

    assert.equal(user.email, 'me@example.com');
    assert.deepEqual(calls, [
      'GET /users/current',
      'POST /auth/refresh',
      'GET /users/current',
    ]);
  });

  it('shares one refresh between concurrent requests', async () => {
    let refreshes = 0;
    mockFetch((url) => {
      if (url === '/auth/refresh') {
        refreshes++;
        return json(200, { message: 'Refreshed' });
      }
      return refreshes > 0
        ? json(200, { email: 'me@example.com' })
        : json(401, { message: 'expired' });
    });
    const client = new BudgetManagerClient('http://api');

    await Promise.all([
      client.request('/users/current', userSchema),
      client.request('/users/current', userSchema),
      client.request('/users/current', userSchema),
    ]);

    assert.equal(refreshes, 1);
  });

  it('gives up with a 401 when the refresh fails', async () => {
    mockFetch((url) =>
      url === '/auth/refresh'
        ? json(401, { message: 'Invalid or expired refresh token' })
        : json(401, { message: 'expired' })
    );

    await assert.rejects(
      new BudgetManagerClient('http://api').request(
        '/users/current',
        userSchema
      ),
      (error: unknown) =>
        error instanceof ApiClientError && error.status === 401
    );
    assert.deepEqual(calls, [
      'GET /users/current',
      'POST /auth/refresh',
      'GET /users/current',
    ]);
  });

  it('never refreshes for a failed login', async () => {
    mockFetch((url) =>
      url === '/auth/csrf'
        ? json(200, { token: 'csrf' })
        : json(401, { message: 'Invalid credentials' })
    );

    await assert.rejects(
      new BudgetManagerClient('http://api').request(
        '/auth/login',
        z.object({ message: z.string() }),
        { method: 'POST', body: { email: 'a@b.c', password: 'x' } }
      )
    );
    assert.deepEqual(calls, ['GET /auth/csrf', 'POST /auth/login']);
  });
});
