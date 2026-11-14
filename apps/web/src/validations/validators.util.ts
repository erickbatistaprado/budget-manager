import { z, type ZodString } from 'zod';

/** The API stores passwords with BCrypt, which accepts at most 72 bytes. */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint: number = character.codePointAt(0) ?? 0;
    if (codePoint < 0x80) {
      bytes += 1;
    } else if (codePoint < 0x800) {
      bytes += 2;
    } else if (codePoint < 0x10000) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

export const passwordSchema: ZodString = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .refine(
    (password: string): boolean => utf8ByteLength(password) <= 72,
    'Password must not exceed 72 bytes'
  )
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[\W_]/, 'Password must contain at least one special character');

export type PasswordType = z.infer<typeof passwordSchema>;

export const emailSchema: ZodString = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email must not exceed 254 characters');

export type EmailType = z.infer<typeof emailSchema>;

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function isValidPassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9-_]{1,30}$/.test(username);
}

export function arePasswordsEqual(
  newPassword: string | undefined,
  confirmPassword: string | undefined
): boolean {
  return newPassword === confirmPassword;
}

export function hasValueInside(data: object): boolean {
  return Object.values(data).some(
    (value: unknown): boolean => Boolean(value) && String(value).length !== 0
  );
}
