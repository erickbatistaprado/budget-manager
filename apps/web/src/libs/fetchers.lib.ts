function getBaseUrl(): string {
  const baseUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined');
  }
  return baseUrl;
}

let csrfToken: string | undefined;
let pendingRefresh: Promise<boolean> | undefined;

const SESSION_PATHS: ReadonlySet<string> = new Set([
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/csrf',
]);

/**
 * Swaps the refresh token cookie for a new session. Concurrent callers share a
 * single request, because each refresh token works only once.
 */
function refreshSession(): Promise<boolean> {
  pendingRefresh ??= fetch(`${getBaseUrl()}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response: Response): boolean => response.ok)
    .catch((): boolean => false)
    .finally((): void => {
      pendingRefresh = undefined;
    });
  return pendingRefresh;
}

function redirectToSignIn(): void {
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/auth')
  ) {
    window.location.assign(new URL('/auth', window.location.origin));
  }
}

/**
 * Sends a request and, when the access token has expired, refreshes the
 * session and retries once. The retry also runs when the refresh fails,
 * because another tab may have rotated the shared cookies a moment earlier.
 * Only a second 401 ends the session and goes back to the sign-in page.
 */
async function sendWithSession(
  path: string,
  send: () => Promise<Response>
): Promise<Response> {
  const response: Response = await send();
  if (response.status !== 401 || SESSION_PATHS.has(path)) {
    return response;
  }
  await refreshSession();
  const retried: Response = await send();
  if (retried.status === 401) {
    redirectToSignIn();
  }
  return retried;
}

function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.cookie
    .split('; ')
    .find((cookie: string): boolean => cookie.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

function isUnsafeMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

async function ensureCsrfToken(): Promise<void> {
  if (csrfToken && getCookieValue('csrf_token')) {
    return;
  }
  const response = await fetch(`${getBaseUrl()}/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    const text: string = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const body = (await response.json()) as { token?: string };
  csrfToken = body.token ?? getCookieValue('csrf_token');
}

function buildHeaders(
  method: string,
  body: BodyInit | null | undefined,
  headers?: HeadersInit
): Headers {
  const result = new Headers(headers);

  if (body && !result.has('Content-Type') && !(body instanceof FormData)) {
    result.set('Content-Type', 'application/json');
  }
  if (isUnsafeMethod(method)) {
    const token = csrfToken ?? getCookieValue('csrf_token');
    if (token && !result.has('X-CSRF-Token')) {
      result.set('X-CSRF-Token', decodeURIComponent(token));
    }
  }
  return result;
}

async function fetcher<T>(
  path: string,
  {
    method = 'GET',
    credentials = 'include',
    headers,
    ...config
  }: RequestInit = {}
): Promise<T> {
  if (isUnsafeMethod(method)) {
    await ensureCsrfToken();
  }
  const headersInit: Headers = buildHeaders(method, config.body, headers);
  const request: RequestInit = {
    method,
    credentials,
    headers: headersInit,
    ...config,
  };
  let response: Response = await sendWithSession(path, (): Promise<Response> =>
    fetch(getBaseUrl() + path, request)
  );

  if (response.status === 403 && isUnsafeMethod(method)) {
    csrfToken = undefined;
    await ensureCsrfToken();
    request.headers = buildHeaders(method, config.body, headers);
    response = await fetch(getBaseUrl() + path, request);
  }
  if (!response.ok) {
    const text: string = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return (await response.json()) as T;
}

export async function getBlobFetcher(path: string): Promise<Blob> {
  const response: Response = await sendWithSession(
    path,
    (): Promise<Response> =>
      fetch(getBaseUrl() + path, { method: 'GET', credentials: 'include' })
  );
  if (!response.ok) {
    const text: string = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.blob();
}

export async function getOptionalBlobFetcher(
  path: string
): Promise<Blob | undefined> {
  const response: Response = await sendWithSession(
    path,
    (): Promise<Response> =>
      fetch(getBaseUrl() + path, { method: 'GET', credentials: 'include' })
  );
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    const text: string = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.blob();
}

export async function getFetcher<T>(
  path: string,
  config?: RequestInit
): Promise<T> {
  return await fetcher<T>(path, config);
}

export async function postFetcher<T>(
  path: string,
  config?: RequestInit
): Promise<T> {
  return await fetcher<T>(path, { method: 'POST', ...config });
}

export async function putFetcher<T>(
  path: string,
  config?: RequestInit
): Promise<T> {
  return await fetcher<T>(path, { method: 'PUT', ...config });
}

export async function patchFetcher<T>(
  path: string,
  config?: RequestInit
): Promise<T> {
  return await fetcher<T>(path, { method: 'PATCH', ...config });
}

export async function deleteFetcher(
  path: string,
  config?: RequestInit
): Promise<void> {
  await fetcher<void>(path, { method: 'DELETE', ...config });
}
