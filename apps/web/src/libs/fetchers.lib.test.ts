import { getFetcher, postFetcher } from './fetchers.lib';

interface FakeResponse {
  readonly status: number;
  readonly ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

function respond(status: number, body: unknown = {}): FakeResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async (): Promise<unknown> => body,
    text: async (): Promise<string> => JSON.stringify(body),
  };
}

type Route = (path: string, method: string) => FakeResponse;

const calls: string[] = [];

function mockApi(route: Route): void {
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const path: string = String(input).replace('http://api', '');
      const method: string = init?.method ?? 'GET';
      calls.push(`${method} ${path}`);
      return route(path, method) as unknown as Response;
    }
  ) as typeof fetch;
}

describe('fetchers session refresh', (): void => {
  beforeAll((): void => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api';
  });

  beforeEach((): void => {
    calls.length = 0;
    window.history.pushState({}, '', '/');
  });

  it('refreshes the session once and retries after a 401', async (): Promise<void> => {
    let refreshed = false;
    mockApi((path: string): FakeResponse => {
      if (path === '/auth/refresh') {
        refreshed = true;
        return respond(200, { message: 'Refreshed' });
      }
      return refreshed
        ? respond(200, { email: 'me@example.com' })
        : respond(401);
    });

    const user = await getFetcher<{ email: string }>('/users/current');

    expect(user.email).toBe('me@example.com');
    expect(calls).toEqual([
      'GET /users/current',
      'POST /auth/refresh',
      'GET /users/current',
    ]);
  });

  it('shares one refresh between concurrent requests', async (): Promise<void> => {
    let refreshes = 0;
    mockApi((path: string): FakeResponse => {
      if (path === '/auth/refresh') {
        refreshes++;
        return respond(200, { message: 'Refreshed' });
      }
      return refreshes > 0 ? respond(200, []) : respond(401);
    });

    await Promise.all([
      getFetcher('/savings'),
      getFetcher('/categories/type/EXPENSE'),
      getFetcher('/users/current'),
    ]);

    expect(refreshes).toBe(1);
  });

  it('fails when the refresh token is no longer valid', async (): Promise<void> => {
    window.history.pushState({}, '', '/auth');
    mockApi((): FakeResponse => respond(401));

    await expect(getFetcher('/users/current')).rejects.toThrow('HTTP 401');
    expect(calls).toEqual([
      'GET /users/current',
      'POST /auth/refresh',
      'GET /users/current',
    ]);
  });

  it('keeps the session when another tab already rotated the token', async (): Promise<void> => {
    let rotatedByOtherTab = false;
    mockApi((path: string): FakeResponse => {
      if (path === '/auth/refresh') {
        rotatedByOtherTab = true;
        return respond(401);
      }
      return rotatedByOtherTab
        ? respond(200, { email: 'me@example.com' })
        : respond(401);
    });

    const user = await getFetcher<{ email: string }>('/users/current');

    expect(user.email).toBe('me@example.com');
  });

  it('does not refresh when the login itself is rejected', async (): Promise<void> => {
    mockApi((path: string): FakeResponse =>
      path === '/auth/csrf' ? respond(200, { token: 'csrf' }) : respond(401)
    );

    await expect(
      postFetcher('/auth/login', {
        body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
      })
    ).rejects.toThrow('HTTP 401');
    expect(calls).not.toContain('POST /auth/refresh');
  });
});
