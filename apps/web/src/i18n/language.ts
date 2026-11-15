export type Language = 'en' | 'pt';

export const LANGUAGE_COOKIE_KEY = 'budget-manager-language';
export const LANGUAGE_STORAGE_KEY = 'budget-manager-language';

export function getHtmlLang(language: Language): 'en' | 'pt-BR' {
  if (language === 'pt') {
    return 'pt-BR';
  }
  return 'en';
}

export function languageFromRequest(
  cookieValue?: string | null,
  acceptLanguage?: string | null
): Language {
  if (cookieValue === 'pt' || cookieValue === 'en') {
    return cookieValue;
  }
  if (acceptLanguage) {
    const normalizedHeader = acceptLanguage.trim().toLowerCase();
    if (normalizedHeader.startsWith('pt')) {
      return 'pt';
    }
  }
  return 'en';
}
