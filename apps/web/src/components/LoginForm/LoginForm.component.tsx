'use client';

import { Input } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import { authenticationService, userService } from '@/services';
import { isValidEmail, isValidPassword } from '@/validations/validators.util';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
  type KeyboardEvent,
} from 'react';

export default function LoginForm(): JSX.Element {
  const { push } = useRouter();
  const { t } = useI18n();
  const [isError, setIsError] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [variant, setVariant] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const submitLabel: string =
    variant === 'login' ? t.auth.loginButton : t.auth.signUp;

  const toggleVariant: () => void = useCallback(
    (): void =>
      setVariant(
        (currentVariant: 'login' | 'register'): 'login' | 'register' =>
          currentVariant === 'login' ? 'register' : 'login'
      ),
    []
  );

  const register: () => Promise<void> = useCallback(async (): Promise<void> => {
    await userService.createUser({ email, name, password });
    await authenticationService.login({ email, password });
  }, [email, name, password]);

  async function onClick(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    setIsError(false);
    setErrorMessage('');

    if (!isValidEmail(email)) {
      setIsError(true);
      setErrorMessage(t.auth.invalidEmail);
      return;
    }
    if (variant === 'register' && !isValidPassword(password)) {
      setIsError(true);
      setErrorMessage(t.auth.invalidPassword);
      return;
    }
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      if (variant === 'login') {
        await authenticationService.login({ email, password });
      } else {
        await register();
      }
      push('/');
    } catch (error: unknown) {
      console.error(error);
      setIsError(true);
      setErrorMessage(
        variant === 'login' ? t.auth.loginError : t.auth.registerError
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onKeyDown({
    key,
  }: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (key === 'Enter') {
      await onClick();
    }
  }

  return (
    <>
      <h2 className="mb-8 text-center text-3xl font-bold text-[var(--ctp-text)]">
        {variant === 'login' ? t.auth.signIn : t.auth.signUp}
      </h2>
      <div className="flex flex-col gap-4">
        {variant === 'register' && (
          <Input
            id="name"
            label={t.common.name}
            type="text"
            value={name}
            onChange={({
              currentTarget: { value },
            }: ChangeEvent<HTMLInputElement>): void => setName(value)}
          />
        )}
        <div className={clsx('rounded-md', isError && 'border border-red-400')}>
          <Input
            id="email"
            label={t.auth.email}
            type="email"
            value={email}
            onChange={({
              currentTarget: { value },
            }: ChangeEvent<HTMLInputElement>): void => setEmail(value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className={clsx('rounded-md', isError && 'border border-red-400')}>
          <Input
            id="password"
            label={t.auth.password}
            type="password"
            value={password}
            onChange={({
              currentTarget: { value },
            }: ChangeEvent<HTMLInputElement>): void => setPassword(value)}
            onKeyDown={onKeyDown}
          />
        </div>
        {errorMessage && (
          <p className="text-sm text-[var(--ctp-red)]">{errorMessage}</p>
        )}
      </div>
      <div className="mt-8">
        <button
          className={clsx(
            'h-12 w-full rounded-md text-lg font-bold transition-all duration-300',
            password.length && !isSubmitting
              ? 'cursor-pointer bg-[var(--ctp-blue)] text-[var(--ctp-crust)] hover:bg-[var(--ctp-lavender)]'
              : 'cursor-not-allowed bg-[var(--ctp-surface1)] text-[var(--ctp-subtext0)]'
          )}
          disabled={!password.length || isSubmitting}
          onClick={onClick}
        >
          {isSubmitting ? t.auth.pleaseWait : submitLabel}
        </button>
      </div>
      <p className="mt-6 text-center text-[var(--ctp-subtext1)]">
        {variant === 'login' ? t.auth.noAccount : t.auth.haveAccount}
        <button
          className="ml-1 cursor-pointer font-semibold text-[var(--ctp-blue)] hover:underline"
          onClick={toggleVariant}
        >
          {variant === 'login' ? t.auth.signUp : t.auth.signIn}
        </button>
      </p>
    </>
  );
}
