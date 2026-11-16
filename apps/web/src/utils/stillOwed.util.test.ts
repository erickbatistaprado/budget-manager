import type { Financing } from '@budget-manager/api-client';
import { RepeatInterval, TransactionType } from '@/enums';
import type { Transaction } from '@/types';
import { stillOwed } from './stillOwed.util';

const category = {
  id: 'shop',
  name: 'Shopping',
  transactionType: TransactionType.EXPENSE,
};

function purchase(
  id: string,
  card: string,
  dueDates: string[],
  source?: 'FINANCING'
): Transaction {
  return {
    id,
    source,
    category,
    card: { id: card, name: card },
    totalValue: dueDates.length * 100,
    repeats: RepeatInterval.NONE,
    date: '2026/10/01',
    installments: dueDates.map((dueDate, index) => ({
      id: `${id}-${index}`,
      paidEarly: false,
      installmentNumber: index + 1,
      totalInstallments: dueDates.length,
      amount: 100,
      dueDate,
    })),
  };
}

const loan = {
  id: 'car',
  contract: { name: 'Car' },
  extraPaid: 0,
  payoffDate: '2027/02/07',
  calculation: {
    schedule: [
      {
        number: 1,
        dueDate: '2026/10/07',
        principal: 900,
        interest: 100,
        insurance: 0,
        fees: 0,
        payment: 1000,
        balance: 2100,
        paidAmount: 1000,
      },
      {
        number: 2,
        dueDate: '2026/11/07',
        principal: 1000,
        interest: 70,
        insurance: 0,
        fees: 0,
        payment: 1070,
        balance: 1100,
        paidAmount: null,
      },
      {
        number: 3,
        dueDate: '2026/12/07',
        principal: 1100,
        interest: 35,
        insurance: 0,
        fees: 0,
        payment: 1135,
        balance: 0,
        paidAmount: null,
      },
    ],
  },
} as unknown as Financing;

it('adds card installments still due and financing balances, once per purchase', (): void => {
  const nubank = purchase('a', 'NuBank', [
    '2026/10/07',
    '2026/11/07',
    '2026/12/07',
  ]);
  const result = stillOwed(
    [
      nubank,
      nubank,
      purchase('b', 'Bradesco', ['2026/11/05']),
      purchase('c', 'Bradesco', ['2026/09/05']),
      purchase('loan', 'Itaú', ['2026/11/07', '2026/12/07'], 'FINANCING'),
    ],
    [loan],
    new Date(2026, 10, 5)
  );
  expect(result.cards).toEqual([
    { card: 'NuBank', amount: 200, installments: 2 },
    { card: 'Bradesco', amount: 100, installments: 1 },
  ]);
  expect(result.financings).toEqual([
    {
      id: 'car',
      name: 'Car',
      outstanding: 2100,
      remainingPayments: 2205,
      installments: 2,
    },
  ]);
  expect(result.total).toBe(2400);
});

it('owes nothing when everything is paid', (): void => {
  expect(stillOwed([], [], new Date(2026, 10, 7))).toEqual({
    cards: [],
    financings: [],
    total: 0,
  });
});
