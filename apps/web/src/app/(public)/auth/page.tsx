'use client';

import { Panel } from '@/components/ui';
import { LoginForm } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import type { JSX } from 'react';

export default function LoginPage(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-[#032258] via-[#2a1c33] to-[#18313f] p-4">
      <Panel
        as="div"
        className="w-full max-w-md backdrop-blur-md transition-all duration-500"
      >
        <h1 className="mb-8 text-center text-4xl font-bold text-[var(--ctp-text)]">
          {t.auth.welcome}
        </h1>
        <LoginForm />
      </Panel>
    </div>
  );
}
