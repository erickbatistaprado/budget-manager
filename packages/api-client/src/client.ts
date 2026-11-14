import { z } from 'zod';

const errorSchema = z.object({ message: z.string().optional() }).passthrough();

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

const SESSION_PATHS = new Set([
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/csrf',
]);

export class BudgetManagerClient {
  private csrfToken: string | undefined;
  private pendingRefresh: Promise<boolean> | undefined;

  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    if (!baseUrl) {
      throw new Error('A Budget Manager API base URL is required.');
    }
    this.baseUrl = baseUrl;
  }

  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.fetch(path, options);
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsed = errorSchema.safeParse(payload);
      throw new ApiClientError(
        parsed.success && parsed.data.message
          ? parsed.data.message
          : `Request failed with status ${response.status}.`,
        response.status
      );
    }
    return schema.parse(payload);
  }

  async command(path: string, options: RequestOptions): Promise<void> {
    const response = await this.fetch(path, options);
    if (!response.ok) {
      throw new ApiClientError(
        `Request failed with status ${response.status}.`,
        response.status
      );
    }
  }

  /**
   * Sends the request and, when the access token has expired, swaps the refresh
   * token for a new session once and retries. Concurrent requests share a single
   * refresh call, because each refresh token works only once.
   */
  private async fetch(
    path: string,
    options: RequestOptions
  ): Promise<Response> {
    const response = await this.send(path, options);
    if (response.status !== 401 || SESSION_PATHS.has(path)) {
      return response;
    }
    // Retry even when the refresh failed: another client sharing the cookie
    // jar may have rotated the token a moment earlier.
    await this.refreshSession();
    return this.send(path, options);
  }

  private refreshSession(): Promise<boolean> {
    this.pendingRefresh ??= fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        this.pendingRefresh = undefined;
      });
    return this.pendingRefresh;
  }

  private async send(path: string, options: RequestOptions): Promise<Response> {
    const method = options.method ?? 'GET';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await this.ensureCsrfToken();
    }
    const headers: Record<string, string> = { ...options.headers };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }
    return fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers,
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  }

  private async ensureCsrfToken(): Promise<void> {
    if (this.csrfToken) {
      return;
    }
    const response = await fetch(`${this.baseUrl}/auth/csrf`, {
      credentials: 'include',
    });
    const payload: unknown = await response.json().catch(() => undefined);
    this.csrfToken = z.object({ token: z.string() }).parse(payload).token;
  }
}
