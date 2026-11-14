import { toStatementImportError } from './statementImport.service';

describe('toStatementImportError', (): void => {
  it('keeps the status and the API message', (): void => {
    const error = toStatementImportError(
      new Error(
        'HTTP 423: {"status":"LOCKED","title":"Locked","message":"This PDF is protected by a password"}'
      )
    );

    expect(error.status).toBe(423);
    expect(error.message).toBe('This PDF is protected by a password');
  });

  it('falls back when the body is not JSON', (): void => {
    const error = toStatementImportError(new Error('HTTP 502: Bad Gateway'));

    expect(error.status).toBe(502);
    expect(error.message).toBe('Request failed with status 502.');
  });

  it('explains network failures', (): void => {
    expect(
      toStatementImportError(new TypeError('Failed to fetch')).status
    ).toBeUndefined();
  });
});
