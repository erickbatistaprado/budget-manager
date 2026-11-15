import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepeatInterval, TransactionType } from '@/enums';
import type { Transaction } from '@/types';
import { deleteFetcher } from '@/libs/fetchers.lib';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import FinancialMovements from './FinancialMovements.component';

jest.mock('@/libs/fetchers.lib', (): object => ({ deleteFetcher: jest.fn() }));
jest.mock('@/libs/transactionsCache.lib', (): object => ({
  refreshTransactions: jest.fn(),
}));
const transaction: Transaction = {
  id: 'series',
  category: {
    id: 'condo',
    name: 'Condo',
    transactionType: TransactionType.EXPENSE,
  },
  totalValue: 700,
  date: '2026/10/31',
  repeats: RepeatInterval.MONTHLY,
  months: [
    {
      month: '2026-12',
      amount: 680,
      date: '2026/12/05',
      notes: 'Discount',
      skipped: false,
    },
  ],
};
beforeEach((): void => {
  jest.clearAllMocks();
});
it.each([
  ['Only December', '/transactions/series/months/2026-12'],
  ['December and the following months', '/transactions/series/from/2026-12'],
])(
  'deletes with scope %s and refreshes all transactions',
  async (choice, path): Promise<void> => {
    render(
      <FinancialMovements
        transaction={transaction}
        selectedDate={new Date(2026, 11, 1)}
      />
    );
    expect(screen.getByText('changed this month')).toBeInTheDocument();
    expect(screen.getByText('Discount')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(
      screen.getByText('Earlier months stay as they are.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: choice }));
    await waitFor((): void =>
      expect(refreshTransactions).toHaveBeenCalledTimes(1)
    );
    expect(deleteFetcher).toHaveBeenCalledWith(path);
  }
);
it('hides a skipped occurrence', (): void => {
  render(
    <FinancialMovements
      transaction={{
        ...transaction,
        months: [{ month: '2026-12', skipped: true }],
      }}
      selectedDate={new Date(2026, 11, 1)}
    />
  );
  expect(screen.queryByText('Condo')).not.toBeInTheDocument();
});
