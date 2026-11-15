import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { RepeatInterval, TransactionType } from '@/enums';
import { postFetcher } from '@/libs/fetchers.lib';
import type { Transaction } from '@/types';
import NewTransaction from './NewTransaction.component';

jest.mock('@/hooks/useAccounts.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: [], mutate: jest.fn() }),
}));

jest.mock('@/hooks/useCards.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [{ id: 'visa', name: 'Visa', closingDay: 25, dueDay: 5 }],
  }),
}));
jest.mock('@/hooks', (): object => ({
  useCategories: (): object => ({
    data: [{ id: 'food', name: 'Food', transactionType: 'EXPENSE' }],
  }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  postFetcher: jest.fn(),
  putFetcher: jest.fn(),
}));
jest.mock('@/libs/transactionsCache.lib', (): object => ({
  refreshTransactions: jest.fn(),
}));
const purchase: Transaction = {
  id: '',
  category: {
    id: 'food',
    name: 'Food',
    transactionType: TransactionType.EXPENSE,
  },
  totalValue: 30,
  repeats: RepeatInterval.NONE,
  date: '2026/12/12',
};
it('previews the bill and sends cardId for non-monthly expenses', async (): Promise<void> => {
  renderWithI18n(<NewTransaction transaction={purchase} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Payment method'), {
    target: { value: 'CREDIT_CARD' },
  });
  fireEvent.change(screen.getByLabelText('Card'), {
    target: { value: 'visa' },
  });
  expect(screen.getByText('Bill due 01/05/2027')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor((): void =>
    expect(postFetcher).toHaveBeenCalledWith(
      '/transactions',
      expect.objectContaining({
        body: expect.stringContaining('"cardId":"visa"'),
      })
    )
  );
});
it('hides the card select for income', (): void => {
  renderWithI18n(
    <NewTransaction
      transaction={{
        ...purchase,
        category: {
          ...purchase.category,
          transactionType: TransactionType.INCOME,
        },
      }}
      onClose={jest.fn()}
    />
  );
  expect(screen.queryByLabelText('Card')).not.toBeInTheDocument();
});

it('hides the card selector after choosing monthly repetition', (): void => {
  renderWithI18n(<NewTransaction transaction={purchase} onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Does it repeat?' }), {
    target: { value: RepeatInterval.MONTHLY },
  });
  expect(screen.queryByLabelText('Card')).not.toBeInTheDocument();
});

it('shows an optional account for Pix and hides it for cash expenses', (): void => {
  renderWithI18n(<NewTransaction transaction={purchase} onClose={jest.fn()} />);
  expect(screen.queryByLabelText('Account')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Payment method'), {
    target: { value: 'PIX' },
  });
  expect(screen.getByLabelText('Account')).toBeInTheDocument();
  expect(screen.queryByLabelText('Card')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Payment method'), {
    target: { value: 'CASH' },
  });
  expect(screen.queryByLabelText('Account')).not.toBeInTheDocument();
});
it('allows an income account and excludes expense-only methods', (): void => {
  renderWithI18n(
    <NewTransaction
      transaction={{
        ...purchase,
        category: {
          ...purchase.category,
          transactionType: TransactionType.INCOME,
        },
      }}
      onClose={jest.fn()}
    />
  );
  fireEvent.change(screen.getByLabelText('Received by'), {
    target: { value: 'CASH' },
  });
  expect(screen.getByLabelText('Account')).toBeInTheDocument();
  expect(
    screen.queryByRole('option', { name: 'Credit card' })
  ).not.toBeInTheDocument();
});
