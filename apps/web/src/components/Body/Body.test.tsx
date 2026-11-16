import { fireEvent, screen } from '@testing-library/react';
import type { MonthOverview } from '@budget-manager/api-client';
import { renderWithI18n } from '@/i18n/testing';
import { en } from '@/i18n/messages/en';
import { pt } from '@/i18n/messages/pt';
import Body from './Body.component';

const overview: MonthOverview = {
  month: '2026-11',
  incomes: 0,
  expenses: 0,
  surplus: 0,
  invested: 0,
  kept: 0,
  accounts: [],
  bills: [],
  unassigned: { count: 1, total: 10 },
};
jest.mock('swr', (): object => ({
  __esModule: true,
  default: (key: string): object => ({
    data: /^\/overview\/\d/.test(key) ? overview : undefined,
  }),
}));
jest.mock('@/hooks', (): object => ({
  useTransactions: (): object => ({ data: [] }),
  useCurrentUser: (): object => ({}),
}));
jest.mock('@/hooks/useCurrentUser.hook', (): object => ({
  __esModule: true,
  default: (): object => ({}),
}));
jest.mock('@/hooks/useCards.hook', (): object => ({
  __esModule: true,
  default: (): object => ({}),
}));
jest.mock('@/hooks/useSavings.hook', (): object => ({
  __esModule: true,
  default: (): object => ({}),
}));
jest.mock('@/components', (): object => ({
  FinancialMovements: (): null => null,
}));
it.each(['en', 'pt'] as const)(
  'activates the no account filter through the Home link in %s',
  (language): void => {
    const labels = language === 'pt' ? pt.dashboard : en.dashboard;
    renderWithI18n(<Body />, { language });
    const link = screen.getByRole('link', { name: labels.unassigned(1) });
    expect(link).toHaveAttribute('href', '#entries');
    fireEvent.click(link);
    expect(
      screen.getByRole('button', { name: `${labels.noAccount} ×` })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: labels.entries })
    ).toHaveAttribute('id', 'entries');
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Filtros' : 'Filters',
      })
    );
    expect(
      screen.getByRole('checkbox', { name: labels.noAccount })
    ).toBeChecked();
  }
);
