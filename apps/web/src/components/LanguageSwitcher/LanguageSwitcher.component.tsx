'use client';

import { Panel, Button } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import type { Language } from '@/i18n/I18nProvider';
import type { JSX } from 'react';

const languages: readonly Language[] = ['en', 'pt'] as const;

const languageLabels: Record<Language, string> = {
  en: 'EN',
  pt: 'PT',
};

export default function LanguageSwitcher(): JSX.Element {
  const { language, setLanguage, t } = useI18n();

  return (
    <Panel aria-label={t.menu.language}>
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {languages.map((item: Language): JSX.Element => (
          <Button
            variant={language === item ? 'primary' : 'secondary'}
            aria-checked={language === item}
            key={item}
            onClick={(): void => setLanguage(item)}
            role="radio"
            type="button"
          >
            {languageLabels[item]}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
