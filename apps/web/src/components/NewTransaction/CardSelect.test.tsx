import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { RepeatInterval, TransactionType } from '@/enums';
import { postFetcher } from '@/libs/fetchers.lib';
import type { Transaction } from '@/types';
import NewTransaction from './NewTransaction.component';

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
  fireEvent.change(screen.getByLabelText('Paid with'), {
    target: { value: 'visa' },
  });
  expect(screen.getByText('Bill due 05/01/2027')).toBeInTheDocument();
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
  expect(screen.queryByLabelText('Paid with')).not.toBeInTheDocument();
});

it('hides the card selector after choosing monthly repetition', (): void => {
  renderWithI18n(<NewTransaction transaction={purchase} onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Does it repeat?' }), {
    target: { value: RepeatInterval.MONTHLY },
  });
  expect(screen.queryByLabelText('Paid with')).not.toBeInTheDocument();
});
