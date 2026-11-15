import { amountInMonth } from './installments.util';
import { cardBillDueDate, nextCardDueDate } from './cardBill.util';
import { getApiDate, parseApiDate } from './globalFormats.util';
import { projectOccurrences, budgetPanels } from './analytics.util';
import { getProjectedTransactionTotal } from './transactionProjection.util';
import { RepeatInterval, TransactionType } from '@/enums';
import type { Transaction } from '@/types';

it.each([
  ['2026/12/12', 25, 5, '2027/01/05'],
  ['2026/12/25', 25, 5, '2027/01/05'],
  ['2026/12/26', 25, 5, '2027/02/05'],
  ['2026/03/02', 3, 10, '2026/03/10'],
  ['2026/02/28', 31, 31, '2026/03/31'],
  ['2028/02/29', 31, 31, '2028/03/31'],
  ['2028/01/31', 31, 30, '2028/02/29'],
  ['2026/01/31', 31, 30, '2026/02/28'],
])(
  'bills %s with closing %s and due %s on %s',
  (date, closingDay, dueDay, expected): void => {
    expect(
      getApiDate(cardBillDueDate(parseApiDate(date), { closingDay, dueDay }))
    ).toBe(expected);
  }
);

it('includes the whole closing day and defaults open bills after their export date', (): void => {
  expect(
    getApiDate(
      cardBillDueDate(new Date(2026, 11, 25, 18), { closingDay: 25, dueDay: 5 })
    )
  ).toBe('2027/01/05');
  expect(getApiDate(nextCardDueDate(parseApiDate('2026/12/05'), 5))).toBe(
    '2027/01/05'
  );
  expect(getApiDate(nextCardDueDate(parseApiDate('2028/02/12'), 31))).toBe(
    '2028/02/29'
  );
});

it('projects the bill into January totals and spending room while keeping the purchase date', (): void => {
  const purchase: Transaction = {
    id: 'purchase',
    category: {
      id: 'food',
      name: 'Food',
      transactionType: TransactionType.EXPENSE,
    },
    totalValue: 90,
    repeats: RepeatInterval.NONE,
    date: '2026/12/12',
    billDueDate: '2027/01/05',
  };
  const january = {
    startDate: parseApiDate('2027/01/01'),
    endDate: parseApiDate('2027/01/31'),
  };
  const december = {
    startDate: parseApiDate('2026/12/01'),
    endDate: parseApiDate('2026/12/31'),
  };
  expect(
    getProjectedTransactionTotal(purchase, january.startDate, january.endDate)
  ).toBe(90);
  expect(
    getProjectedTransactionTotal(purchase, december.startDate, december.endDate)
  ).toBe(0);
  const occurrences = projectOccurrences([purchase], january);
  expect(occurrences).toHaveLength(1);
  expect(
    budgetPanels([], occurrences, parseApiDate('2027/01/01')).current.committed
  ).toBe(90);
  expect(amountInMonth(purchase, january.startDate)).toBe(90);
  expect(amountInMonth(purchase, december.startDate)).toBe(0);
  expect(purchase.date).toBe('2026/12/12');
});
