/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import proxy from './proxy';

function visit(
  path: string,
  cookies: Record<string, string> = {}
): string | null {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]: [string, string]): string => `${name}=${value}`)
        .join('; '),
    },
  });
  return proxy(request).headers.get('location');
}

describe('proxy', (): void => {
  it('sends visitors without a session to sign-in', (): void => {
    expect(visit('/')).toBe('http://localhost:3000/auth');
  });

  it('lets a refresh-only session reach private pages', (): void => {
    expect(visit('/', { refresh_token: 'token' })).toBeNull();
  });

  it('keeps sign-in reachable with only a refresh token', (): void => {
    expect(visit('/auth', { refresh_token: 'possibly-expired' })).toBeNull();
  });

  it('skips sign-in with a live access token', (): void => {
    expect(visit('/auth', { access_token: 'token' })).toBe(
      'http://localhost:3000/'
    );
  });
});
