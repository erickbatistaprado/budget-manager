import { RepeatInterval, TransactionType } from '@/enums';
import type { Transaction } from '@/types';
import { monthlyOccurrence } from './monthlyTransaction.util';
import { amountInMonth } from './installments.util';
import { projectOccurrences } from './analytics.util';
import { getProjectedTransactionTotal } from './transactionProjection.util';

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
  repeatUntil: '2027/02/01',
  notes: 'Fee',
  months: [
    {
      month: '2026-12',
      amount: 680,
      date: '2026/12/01',
      notes: 'Discount',
      skipped: false,
    },
    { month: '2027-01', skipped: true },
  ],
};

it('resolves range, overrides, notes, skips and clamped days consistently', (): void => {
  expect(monthlyOccurrence(transaction, new Date(2026, 8, 1))).toBeNull();
  expect(monthlyOccurrence(transaction, new Date(2027, 2, 1))).toBeNull();
  expect(monthlyOccurrence(transaction, new Date(2027, 0, 1))).toBeNull();
  expect(monthlyOccurrence(transaction, new Date(2026, 10, 1))?.date).toEqual(
    new Date(2026, 10, 30)
  );
  expect(monthlyOccurrence(transaction, new Date(2027, 1, 1))?.date).toEqual(
    new Date(2027, 1, 28)
  );
  expect(monthlyOccurrence(transaction, new Date(2026, 11, 1))).toEqual({
    amount: 680,
    date: new Date(2026, 11, 1),
    notes: 'Discount',
    changed: true,
  });
  expect(amountInMonth(transaction, new Date(2026, 11, 1))).toBe(680);
  expect(amountInMonth(transaction, new Date(2027, 0, 1))).toBe(0);
  const range = {
    startDate: new Date(2026, 10, 1),
    endDate: new Date(2027, 2, 31),
  };
  const occurrences = projectOccurrences([transaction], range);
  expect(occurrences.map((occurrence): number => occurrence.amount)).toEqual([
    700, 680, 700,
  ]);
  expect(occurrences[1]?.merchant).toBe('Discount');
  expect(
    getProjectedTransactionTotal(transaction, range.startDate, range.endDate)
  ).toBe(2080);
  expect(
    getProjectedTransactionTotal(
      transaction,
      new Date(2026, 11, 2),
      new Date(2026, 11, 31)
    )
  ).toBe(0);
});
