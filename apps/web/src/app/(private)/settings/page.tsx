'use client';

import { ProfileForm } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import type { JSX } from 'react';

export default function ProfilePage(): JSX.Element {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 text-[var(--ctp-text)] sm:p-5">
      <h1 className="text-xl font-semibold">{t.profile.title}</h1>
      <ProfileForm />
    </main>
  );
}
