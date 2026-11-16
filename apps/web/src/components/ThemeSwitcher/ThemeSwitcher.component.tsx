'use client';

import clsx from 'clsx';
import type { JSX } from 'react';
import { useTheme, type Theme } from '@/hooks/useTheme.hook';
import { useI18n } from '@/i18n/useI18n';

const themes = ['latte', 'macchiato', 'system'] as const;

export default function ThemeSwitcher(): JSX.Element {
  const { theme: selectedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const themeLabels: Record<Theme, string> = {
    latte: t.profile.light,
    macchiato: t.profile.dark,
    system: t.profile.system,
  };

  return (
    <div
      aria-label={t.profile.theme}
      className="rounded-lg bg-[var(--ctp-surface0)] p-2"
    >
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {themes.map((theme: Theme): JSX.Element => (
          <button
            aria-checked={selectedTheme === theme}
            className={clsx(
              'cursor-pointer rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              selectedTheme === theme
                ? 'bg-[var(--ctp-blue)] text-[var(--ctp-crust)]'
                : 'text-[var(--ctp-text)] hover:bg-[var(--ctp-blue)]/20'
            )}
            key={theme}
            onClick={(): void => setTheme(theme)}
            role="radio"
            type="button"
          >
            {themeLabels[theme]}
          </button>
        ))}
      </div>
    </div>
  );
}
