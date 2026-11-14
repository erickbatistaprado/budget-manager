import { type NextRequest, NextResponse } from 'next/server';

export default function proxy({
  cookies,
  nextUrl: { pathname, origin },
}: NextRequest): NextResponse<unknown> {
  // The access token lives 15 minutes; the refresh token keeps the session
  // alive, and the client swaps it for a new access token on the first 401.
  // Only a live access token skips the sign-in page: a refresh token alone may
  // be expired, and treating it as a session would loop between / and /auth.
  const accessToken: string | undefined = cookies.get('access_token')?.value;
  const token: string | undefined =
    accessToken ?? cookies.get('refresh_token')?.value;
  const protectedRoutes: string[] = [
    '/',
    '/profile',
    '/analytics',
    '/savings',
    '/import',
  ];

  if (
    !token &&
    protectedRoutes.some(
      (route: string): boolean =>
        pathname.startsWith(route) && pathname !== '/auth'
    )
  ) {
    return NextResponse.redirect(new URL('/auth', origin));
  }
  if (accessToken && pathname === '/auth') {
    return NextResponse.redirect(new URL('/', origin));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/profile/:path*',
    '/analytics/:path*',
    '/savings/:path*',
    '/import/:path*',
    '/auth',
  ],
};
