'use client';

import { Panel, Button, TextInput, Select, Field } from '@/components/ui';
import { useCurrentUser, useProfileImage } from '@/hooks';
import { useTheme } from '@/hooks/useTheme.hook';
import { useI18n } from '@/i18n/useI18n';
import {
  deleteFetcher,
  getBlobFetcher,
  getFetcher,
  postFetcher,
  putFetcher,
} from '@/libs/fetchers.lib';
import { isValidPassword } from '@/validations/validators.util';
import type { OpenApi } from '@budget-manager/api-client';
import type { User } from '@/types';
import Image from 'next/image';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
} from 'react';
import useSWR from 'swr';

type Section = 'name' | 'photo' | 'password' | 'preferences' | 'backup';
type Message =
  | 'saved'
  | 'nameError'
  | 'passwordError'
  | 'currentPasswordError'
  | 'samePasswordError'
  | 'preferencesError'
  | 'imageError'
  | 'imageSizeError'
  | 'imageTypeError'
  | 'deleteImageError'
  | 'backupError';

export default function ProfileForm(): JSX.Element {
  const { t } = useI18n();
  const { data: user, error } = useCurrentUser();
  if (error) return <p role="alert">{t.profile.loadError}</p>;
  if (!user) return <p role="status">{t.profile.loading}</p>;
  return <ProfileSections user={user} />;
}

function ProfileSections({ user }: Readonly<{ user: User }>): JSX.Element {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const { mutate: mutateUser } = useCurrentUser();
  const {
    data: photo,
    mutate: mutatePhoto,
    error: photoError,
  } = useProfileImage();
  const { data: summary, error: summaryError } = useSWR(
    '/users/current/data-summary',
    getFetcher<OpenApi.UserDataSummary>
  );
  const [name, setName] = useState(user.name ?? '');
  const [salaryDay, setSalaryDay] = useState(String(user.salaryDay ?? ''));
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [messages, setMessages] = useState<Partial<Record<Section, Message>>>(
    {}
  );
  const [busy, setBusy] = useState<Partial<Record<Section, boolean>>>({});
  const photoInput = useRef<HTMLInputElement>(null);
  const photoUrl = useMemo(
    (): string | undefined => (photo ? URL.createObjectURL(photo) : undefined),
    [photo]
  );
  useEffect(
    (): (() => void) => (): void => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl]
  );

  function message(section: Section): JSX.Element {
    const value = messages[section];
    return (
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-sm"
      >
        {value && t.profile[value]}
      </p>
    );
  }
  async function run(
    section: Section,
    action: () => Promise<void>,
    failure: Message
  ): Promise<void> {
    setBusy((previous): Partial<Record<Section, boolean>> => ({
      ...previous,
      [section]: true,
    }));
    setMessages((previous): Partial<Record<Section, Message>> => ({
      ...previous,
      [section]: undefined,
    }));
    try {
      await action();
      setMessages((previous): Partial<Record<Section, Message>> => ({
        ...previous,
        [section]: 'saved',
      }));
    } catch (error: unknown) {
      let result = failure;
      if (
        error instanceof Error &&
        error.message.includes('Current password is missing or incorrect')
      )
        result = 'currentPasswordError';
      if (
        error instanceof Error &&
        error.message.includes('Password must be different')
      )
        result = 'samePasswordError';
      if (error instanceof Error && error.message.startsWith('HTTP 413'))
        result = 'imageSizeError';
      setMessages((previous): Partial<Record<Section, Message>> => ({
        ...previous,
        [section]: result,
      }));
    } finally {
      setBusy((previous): Partial<Record<Section, boolean>> => ({
        ...previous,
        [section]: false,
      }));
    }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !summary) return;
    let error: Message | undefined;
    if (!['image/png', 'image/jpeg'].includes(file.type))
      error = 'imageTypeError';
    if (file.size > summary.maxProfileImageBytes) error = 'imageSizeError';
    if (error) {
      setMessages((previous): Partial<Record<Section, Message>> => ({
        ...previous,
        photo: error,
      }));
      return;
    }
    await run(
      'photo',
      async (): Promise<void> => {
        const body = new FormData();
        body.append('file', file);
        await postFetcher('/user-image', { body });
        await mutatePhoto();
      },
      'imageError'
    );
  }
  function saveName(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(
      'name',
      async (): Promise<void> => {
        await putFetcher('/users', {
          body: JSON.stringify({ name: name.trim() }),
        });
        await mutateUser();
      },
      'nameError'
    );
  }
  function savePassword(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(
      'password',
      async (): Promise<void> => {
        await putFetcher('/users', {
          body: JSON.stringify({ currentPassword, password }),
        });
        setCurrentPassword('');
        setPassword('');
        setConfirmation('');
      },
      'passwordError'
    );
  }
  function savePreferences(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(
      'preferences',
      async (): Promise<void> => {
        await putFetcher('/users/current/preferences', {
          body: JSON.stringify({
            salaryDay: salaryDay === '' ? null : Number(salaryDay),
          }),
        });
        setSalaryDay(salaryDay === '' ? '' : String(Number(salaryDay)));
        await mutateUser();
      },
      'preferencesError'
    );
  }
  async function download(): Promise<void> {
    await run(
      'backup',
      async (): Promise<void> => {
        const blob = await getBlobFetcher('/users/current/export');
        const backup = JSON.parse(await blob.text()) as { exportedAt: string };
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `budget-manager-backup-${backup.exportedAt.slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout((): void => URL.revokeObjectURL(url), 1000);
      },
      'backupError'
    );
  }
  const rules = [
    { label: t.profile.ruleLength, met: password.length >= 8 },
    {
      label: t.profile.ruleBytes,
      met: new Blob([password]).size <= 72 && password.length > 0,
    },
    { label: t.profile.ruleUpper, met: /[A-Z]/.test(password) },
    { label: t.profile.ruleLower, met: /[a-z]/.test(password) },
    { label: t.profile.ruleNumber, met: /\d/.test(password) },
    { label: t.profile.ruleSpecial, met: /[\W_]/.test(password) },
  ];
  const validSalary =
    salaryDay === '' ||
    (Number.isInteger(Number(salaryDay)) &&
      Number(salaryDay) >= 1 &&
      Number(salaryDay) <= 31);
  return (
    <>
      <Panel className="min-w-0 space-y-4" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-lg font-semibold">
          {t.profile.personal}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--ctp-surface1)]">
            {photoUrl && (
              <Image
                src={photoUrl}
                alt={t.profile.photo}
                fill
                className="object-cover"
              />
            )}
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/png,image/jpeg"
            aria-label={t.profile.chooseImage}
            className="hidden"
            onChange={(event): void => {
              void upload(event);
            }}
          />
          <Button
            variant="secondary"
            disabled={busy.photo || !summary}
            onClick={(): void => photoInput.current?.click()}
          >
            {t.profile.chooseImage}
          </Button>
          <Button
            variant="secondary"
            disabled={busy.photo || !photo}
            onClick={(): void => {
              void run(
                'photo',
                async (): Promise<void> => {
                  await deleteFetcher('/user-image');
                  await mutatePhoto(undefined, { revalidate: false });
                },
                'deleteImageError'
              );
            }}
          >
            {t.profile.deleteImage}
          </Button>
        </div>
        {summary && (
          <p className="text-sm text-[var(--ctp-subtext0)]">
            PNG / JPEG · {summary.maxProfileImageBytes / 1024 / 1024} MiB
          </p>
        )}
        {photoError && <p role="alert">{t.profile.imageError}</p>}
        {message('photo')}
        <form onSubmit={saveName} className="space-y-3">
          <Field label={t.common.name}>
            <TextInput
              value={name}
              maxLength={50}
              autoComplete="name"
              onChange={(event): void => setName(event.currentTarget.value)}
            />
          </Field>
          <Field label={t.auth.email}>
            <TextInput
              type="email"
              value={user.email}
              readOnly
              autoComplete="email"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            disabled={busy.name || !name.trim() || name.trim() === user.name}
          >
            {t.common.save}
          </Button>
          {message('name')}
        </form>
      </Panel>
      <Panel className="min-w-0 space-y-4" aria-labelledby="security-heading">
        <h2 id="security-heading" className="text-lg font-semibold">
          {t.profile.security}
        </h2>
        <p id="sessions-note" className="text-sm text-[var(--ctp-subtext0)]">
          {t.profile.sessionsNote}
        </p>
        <form
          onSubmit={savePassword}
          className="space-y-3"
          aria-describedby="sessions-note"
        >
          <Field label={t.profile.currentPassword}>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event): void =>
                setCurrentPassword(event.currentTarget.value)
              }
            />
          </Field>
          <Field label={t.profile.newPassword}>
            <TextInput
              type="password"
              autoComplete="new-password"
              value={password}
              aria-describedby="password-rules"
              onChange={(event): void => setPassword(event.currentTarget.value)}
            />
          </Field>
          <ul
            id="password-rules"
            aria-label={t.profile.passwordRules}
            aria-live="polite"
            className="space-y-1 text-sm"
          >
            {rules.map((rule): JSX.Element => (
              <li key={rule.label}>
                {rule.met ? '✓' : '○'} {rule.label}
              </li>
            ))}
          </ul>
          <Field label={t.profile.confirmPassword}>
            <TextInput
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event): void =>
                setConfirmation(event.currentTarget.value)
              }
            />
          </Field>
          {confirmation && confirmation !== password && (
            <p role="alert">{t.profile.passwordsMatchError}</p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={
              busy.password ||
              !currentPassword ||
              !isValidPassword(password) ||
              password !== confirmation
            }
          >
            {t.common.save}
          </Button>
          {message('password')}
        </form>
      </Panel>
      <Panel
        className="min-w-0 space-y-4"
        aria-labelledby="preferences-heading"
      >
        <h2 id="preferences-heading" className="text-lg font-semibold">
          {t.profile.preferences}
        </h2>
        <Field label={t.profile.language}>
          <Select
            value={language}
            onChange={(event): void => {
              const value = event.currentTarget.value;
              if (value === 'en' || value === 'pt') {
                setLanguage(value);
                setMessages((previous): Partial<Record<Section, Message>> => ({
                  ...previous,
                  preferences: 'saved',
                }));
              }
            }}
          >
            <option value="pt">Português (Brasil)</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label={t.profile.theme}>
          <Select
            value={theme}
            onChange={(event): void => {
              const value = event.currentTarget.value;
              if (
                value === 'latte' ||
                value === 'macchiato' ||
                value === 'system'
              ) {
                setTheme(value);
                setMessages((previous): Partial<Record<Section, Message>> => ({
                  ...previous,
                  preferences: 'saved',
                }));
              }
            }}
          >
            <option value="latte">{t.profile.light}</option>
            <option value="macchiato">{t.profile.dark}</option>
            <option value="system">{t.profile.system}</option>
          </Select>
        </Field>
        <form onSubmit={savePreferences} className="space-y-3">
          <Field label={t.profile.salaryDay}>
            <TextInput
              type="number"
              min={1}
              max={31}
              step={1}
              value={salaryDay}
              aria-describedby="salary-help"
              onChange={(event): void =>
                setSalaryDay(event.currentTarget.value)
              }
            />
          </Field>
          <p id="salary-help" className="text-sm text-[var(--ctp-subtext0)]">
            {t.profile.optional}
          </p>
          <Button
            type="submit"
            variant="primary"
            disabled={
              busy.preferences ||
              !validSalary ||
              salaryDay === String(user.salaryDay ?? '')
            }
          >
            {t.common.save}
          </Button>
        </form>
        {message('preferences')}
      </Panel>
      <Panel className="min-w-0 space-y-4" aria-labelledby="data-heading">
        <h2 id="data-heading" className="text-lg font-semibold">
          {t.profile.data}
        </h2>
        {summaryError && <p role="alert">{t.profile.summaryError}</p>}
        {summary && (
          <>
            <p>
              {summary.entryCount} {t.profile.entries}
            </p>
            <p>
              {summary.firstEntryDate
                ? `${t.profile.firstEntry} ${new Date(summary.firstEntryDate + 'T12:00:00').toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}`
                : t.profile.noEntries}
            </p>
          </>
        )}
        <Button
          variant="secondary"
          disabled={busy.backup}
          onClick={(): void => {
            void download();
          }}
        >
          {t.profile.backup}
        </Button>
        {message('backup')}
      </Panel>
    </>
  );
}
