import { SideMenu } from '@/components';
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import I18nProvider, {
  getHtmlLang,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_STORAGE_KEY,
  saveLanguage,
} from './I18nProvider';
import { languageFromRequest } from './language';
import { renderWithI18n } from './testing';
import { useI18n } from './useI18n';

jest.mock('@/services', () => ({
  authenticationService: { logout: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: (): string => '/',
  useRouter: () => ({ push: mockPush }),
}));

function ConsumerComponent(): JSX.Element {
  const { language, setLanguage, t } = useI18n();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="title">{t.menu.home}</span>
      <button onClick={(): void => setLanguage('pt')} type="button">
        To PT
      </button>
      <button onClick={(): void => setLanguage('en')} type="button">
        To EN
      </button>
    </div>
  );
}

describe('i18n system', (): void => {
  beforeEach((): void => {
    localStorage.clear();
    document.cookie = `${LANGUAGE_COOKIE_KEY}=; path=/; max-age=0`;
    jest.restoreAllMocks();
    document.documentElement.lang = 'en';
  });

  describe('language from request (cookie and Accept-Language)', (): void => {
    it('uses valid cookie value directly', (): void => {
      expect(languageFromRequest('pt', 'en-US')).toBe('pt');
      expect(languageFromRequest('en', 'pt-BR')).toBe('en');
    });

    it('ignores invalid cookie values and falls back to Accept-Language', (): void => {
      expect(languageFromRequest('es', 'pt-BR')).toBe('pt');
      expect(languageFromRequest('', 'pt-BR')).toBe('pt');
      expect(languageFromRequest(null, 'pt-BR')).toBe('pt');
      expect(languageFromRequest(undefined, 'pt-BR')).toBe('pt');
    });

    it('maps Accept-Language starting with pt to pt', (): void => {
      expect(languageFromRequest(null, 'pt')).toBe('pt');
      expect(languageFromRequest(null, 'pt-BR')).toBe('pt');
      expect(languageFromRequest(null, 'pt-PT,pt;q=0.9')).toBe('pt');
      expect(languageFromRequest(null, 'PT-BR')).toBe('pt');
    });

    it('falls back to en when Accept-Language does not start with pt', (): void => {
      expect(languageFromRequest(null, 'en-US')).toBe('en');
      expect(languageFromRequest(null, 'en-GB,en;q=0.8')).toBe('en');
      expect(languageFromRequest(null, 'es-ES')).toBe('en');
      expect(languageFromRequest(null, 'fr-FR')).toBe('en');
    });

    it('defaults to en when both cookie and Accept-Language are absent', (): void => {
      expect(languageFromRequest(null, null)).toBe('en');
      expect(languageFromRequest(undefined, undefined)).toBe('en');
      expect(languageFromRequest('', '')).toBe('en');
    });
  });

  describe('saving language (cookie and localStorage)', (): void => {
    it('writes both cookie and localStorage', (): void => {
      saveLanguage('pt');

      expect(document.cookie).toContain('budget-manager-language=pt');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt');

      saveLanguage('en');

      expect(document.cookie).toContain('budget-manager-language=en');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });

    it('handles localStorage errors gracefully inside try/catch', (): void => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation((): void => {
        throw new Error('Access denied');
      });

      expect((): void => {
        saveLanguage('pt');
      }).not.toThrow();
      expect(document.cookie).toContain('budget-manager-language=pt');
    });
  });

  describe('switching language', (): void => {
    it('switches language, updates cookie, localStorage and html lang attribute', (): void => {
      render(
        <I18nProvider initialLanguage="en">
          <ConsumerComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('lang')).toHaveTextContent('en');
      expect(screen.getByTestId('title')).toHaveTextContent('Home');
      expect(document.documentElement.lang).toBe('en');

      fireEvent.click(screen.getByRole('button', { name: 'To PT' }));

      expect(screen.getByTestId('lang')).toHaveTextContent('pt');
      expect(screen.getByTestId('title')).toHaveTextContent('Início');
      expect(document.documentElement.lang).toBe('pt-BR');
      expect(document.cookie).toContain('budget-manager-language=pt');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt');

      fireEvent.click(screen.getByRole('button', { name: 'To EN' }));

      expect(screen.getByTestId('lang')).toHaveTextContent('en');
      expect(screen.getByTestId('title')).toHaveTextContent('Home');
      expect(document.documentElement.lang).toBe('en');
      expect(document.cookie).toContain('budget-manager-language=en');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });

    it('returns correct html lang for both languages', (): void => {
      expect(getHtmlLang('en')).toBe('en');
      expect(getHtmlLang('pt')).toBe('pt-BR');
    });
  });

  describe('side menu language switch', (): void => {
    it('switches the whole side menu text when toggling EN and PT', (): void => {
      renderWithI18n(<SideMenu onClose={jest.fn()} />, { language: 'en' });

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();

      const ptRadio: HTMLElement = screen.getByRole('radio', { name: 'PT' });
      fireEvent.click(ptRadio);

      expect(screen.getByText('Início')).toBeInTheDocument();
      expect(screen.getByText('Sair')).toBeInTheDocument();
      expect(document.documentElement.lang).toBe('pt-BR');
    });
  });

  describe('component rendered in each language', (): void => {
    it('renders SideMenu in English', (): void => {
      renderWithI18n(<SideMenu onClose={jest.fn()} />, { language: 'en' });
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('renders SideMenu in Portuguese', (): void => {
      renderWithI18n(<SideMenu onClose={jest.fn()} />, { language: 'pt' });
      expect(screen.getByText('Início')).toBeInTheDocument();
      expect(screen.getByText('Importar extrato')).toBeInTheDocument();
      expect(screen.getByText('Perfil')).toBeInTheDocument();
    });
  });
});
