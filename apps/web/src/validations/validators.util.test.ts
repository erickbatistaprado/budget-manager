import { isValidPassword } from './validators.util';

describe('isValidPassword', (): void => {
  it.each([
    'Abcdef1!',
    'Correct Horse Battery 9',
    'Ação-Válida1',
    'Pass_word1',
  ])('accepts %s', (password: string): void => {
    expect(isValidPassword(password)).toBe(true);
  });

  it('accepts up to 72 bytes, the limit the API enforces', (): void => {
    expect(isValidPassword(`Aa1~${'a'.repeat(68)}`)).toBe(true);
    expect(isValidPassword(`Aa1~${'a'.repeat(69)}`)).toBe(false);
    expect(isValidPassword(`Aa1~${'ç'.repeat(35)}`)).toBe(false);
  });

  it.each(['Ab1!', 'abcdefg1!', 'ABCDEFG1!', 'Abcdefgh!', 'Abcdefgh1'])(
    'rejects %s',
    (password: string): void => {
      expect(isValidPassword(password)).toBe(false);
    }
  );
});
