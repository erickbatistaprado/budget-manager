import type { TransactionType } from '@/enums';
import { postFetcher } from '@/libs/fetchers.lib';
import type { Category } from '@/types';
import {
  statementImportResultSchema,
  statementPreviewSchema,
  type StatementImportLine,
  type StatementImportResult,
  type StatementPreview,
} from '@budget-manager/api-client';

/** HTTP 423: the PDF is protected, or the password given does not open it. */
export const PASSWORD_REQUIRED_STATUS = 423;

export class StatementImportError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status: number | undefined) {
    super(message);
    this.name = 'StatementImportError';
    this.status = status;
  }
}

/** The fetchers throw `HTTP <status>: <body>`; this recovers the API's message. */
export function toStatementImportError(error: unknown): StatementImportError {
  const text: string = error instanceof Error ? error.message : String(error);
  const match: RegExpMatchArray | null = /^HTTP (\d{3}): ([\s\S]*)$/.exec(text);
  if (!match) {
    return new StatementImportError(
      'The statement could not be sent. Check your connection.',
      undefined
    );
  }
  const status = Number(match[1]);
  let message = `Request failed with status ${status}.`;
  try {
    const body: unknown = JSON.parse(match[2] ?? '');
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string' &&
      body.message
    ) {
      message = body.message;
    }
  } catch {
    // The body was not JSON; keep the generic message.
  }
  return new StatementImportError(message, status);
}

class StatementImportService {
  async preview(file: File, password?: string): Promise<StatementPreview> {
    const body = new FormData();
    body.append('file', file);
    if (password) {
      body.append('password', password);
    }
    try {
      return statementPreviewSchema.parse(
        await postFetcher<unknown>('/statement-imports/preview', { body })
      );
    } catch (error: unknown) {
      throw toStatementImportError(error);
    }
  }

  async importLines(
    lines: readonly StatementImportLine[]
  ): Promise<StatementImportResult> {
    try {
      return statementImportResultSchema.parse(
        await postFetcher<unknown>('/statement-imports', {
          body: JSON.stringify({ lines }),
        })
      );
    } catch (error: unknown) {
      throw toStatementImportError(error);
    }
  }

  async createCategory(
    name: string,
    transactionType: TransactionType
  ): Promise<Category> {
    try {
      return await postFetcher<Category>('/categories', {
        body: JSON.stringify({ name, transactionType }),
      });
    } catch (error: unknown) {
      throw toStatementImportError(error);
    }
  }
}

export const statementImportService = new StatementImportService();
