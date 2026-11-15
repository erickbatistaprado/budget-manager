import { renderWithI18n } from '@/i18n/testing';
import { fireEvent, screen } from '@testing-library/react';
import LanguageSwitcher from './LanguageSwitcher.component';

describe('LanguageSwitcher', (): void => {
  it('renders language switch buttons EN and PT', (): void => {
    renderWithI18n(<LanguageSwitcher />);

    expect(screen.getByRole('radio', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'PT' })).toBeInTheDocument();
  });

  it('marks current language as active', (): void => {
    renderWithI18n(<LanguageSwitcher />, { language: 'pt' });

    expect(screen.getByRole('radio', { name: 'PT' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'EN' })).not.toBeChecked();
  });

  it('switches language when clicking a language button', (): void => {
    renderWithI18n(<LanguageSwitcher />, { language: 'en' });

    const ptButton: HTMLElement = screen.getByRole('radio', { name: 'PT' });
    fireEvent.click(ptButton);

    expect(ptButton).toBeChecked();
    expect(screen.getByRole('radio', { name: 'EN' })).not.toBeChecked();
  });
});
