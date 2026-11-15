import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepeatInterval, TransactionType } from '@/enums';
import type { Transaction } from '@/types';
import { postFetcher, putFetcher } from '@/libs/fetchers.lib';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import NewTransaction from './NewTransaction.component';

jest.mock('@/hooks', (): object => ({
  useCategories: (): object => ({ data: [] }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  postFetcher: jest.fn(),
  putFetcher: jest.fn(),
}));
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
  ['Only December', putFetcher, '/transactions/series/months/2026-12'],
  [
    'December and the following months',
    postFetcher,
    '/transactions/series/split/2026-12',
  ],
])(
  'asks scope before opening the form and saves %s',
  async (choice, fetcher, path): Promise<void> => {
    const onClose = jest.fn();
    render(
      <NewTransaction
        transaction={transaction}
        selectedDate={new Date(2026, 11, 1)}
        onClose={onClose}
      />
    );
    expect(
      screen.getByText('Earlier months stay as they are.')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: choice }));
    expect(screen.getByLabelText('Value')).toHaveValue(680);
    expect(screen.getByLabelText('Notes')).toHaveValue('Discount');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor((): void => expect(onClose).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledWith(
      path,
      expect.objectContaining({ body: expect.stringContaining('2026/12/05') })
    );
    expect(refreshTransactions).toHaveBeenCalledTimes(1);
  }
);
