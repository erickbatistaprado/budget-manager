'use client';
import { Page } from '@/components/ui';

import { ProfileForm } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import type { JSX } from 'react';

export default function SettingsPage(): JSX.Element {
  const { t } = useI18n();

  return (
    <Page>
      <h1 className="text-xl font-semibold">{t.profile.title}</h1>
      <ProfileForm />
    </Page>
  );
}
