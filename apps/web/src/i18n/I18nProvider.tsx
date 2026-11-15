'use client';

import {
  createContext,
  useEffect,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {
  getHtmlLang,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from './language';
import { en, type Messages } from './messages/en';
import { pt } from './messages/pt';

export type { Language };
export { getHtmlLang, LANGUAGE_COOKIE_KEY, LANGUAGE_STORAGE_KEY };

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Messages;
}

const ONE_YEAR_IN_SECONDS = 31536000;

export function saveLanguage(language: Language): void {
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${LANGUAGE_COOKIE_KEY}=${language}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
    }
  } catch {
    // Ignore cookie write errors
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  } catch {
    // Ignore localStorage access errors
  }
}

export const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: (): void => {},
  t: en,
});

export interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: Language;
}

export default function I18nProvider({
  children,
  initialLanguage = 'en',
}: Readonly<I18nProviderProps>): JSX.Element {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  function setLanguage(newLanguage: Language): void {
    setLanguageState(newLanguage);
    saveLanguage(newLanguage);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = getHtmlLang(newLanguage);
    }
  }

  useEffect((): void => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = getHtmlLang(language);
    }
  }, [language]);

  const messages: Messages = language === 'pt' ? pt : en;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: messages }}>
      {children}
    </I18nContext.Provider>
  );
}
