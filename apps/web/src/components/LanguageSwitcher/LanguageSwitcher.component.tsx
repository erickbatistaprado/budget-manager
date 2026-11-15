'use client';

import { useI18n } from '@/i18n/useI18n';
import type { Language } from '@/i18n/I18nProvider';
import clsx from 'clsx';
import type { JSX } from 'react';

const languages: readonly Language[] = ['en', 'pt'] as const;

const languageLabels: Record<Language, string> = {
  en: 'EN',
  pt: 'PT',
};

export default function LanguageSwitcher(): JSX.Element {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      aria-label={t.menu.language}
      className="rounded-lg bg-[var(--ctp-surface0)] p-2"
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {languages.map((item: Language): JSX.Element => (
          <button
            aria-checked={language === item}
            className={clsx(
              'cursor-pointer rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              language === item
                ? 'bg-[var(--ctp-blue)] text-[var(--ctp-crust)]'
                : 'text-[var(--ctp-text)] hover:bg-[var(--ctp-blue)]/20'
            )}
            key={item}
            onClick={(): void => setLanguage(item)}
            role="radio"
            type="button"
          >
            {languageLabels[item]}
          </button>
        ))}
      </div>
    </div>
  );
}
