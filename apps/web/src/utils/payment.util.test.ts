import { Bank, PaymentMethod } from '@budget-manager/api-client';
import { en } from '@/i18n/messages/en';
import { pt } from '@/i18n/messages/pt';
import { paymentLabel, paymentRanking } from './payment.util';
import { RepeatInterval, TransactionType } from '@/enums';
import type { Transaction } from '@/types';
it('labels unknown, cards, accounts and cash in both languages', (): void => {
  expect(paymentLabel({}, en.payments.methods)).toBe('');
  expect(
    paymentLabel(
      {
        paymentMethod: PaymentMethod.CREDIT_CARD,
        card: { id: 'card', name: 'Bradesco' },
      },
      en.payments.methods
    )
  ).toBe('Credit card · Bradesco');
  expect(
    paymentLabel(
      {
        paymentMethod: PaymentMethod.PIX,
        account: { id: 'account', name: 'Nubank', bank: Bank.NUBANK },
      },
      pt.payments.methods
    )
  ).toBe('Pix · Nubank');
  expect(
    paymentLabel({ paymentMethod: PaymentMethod.CASH }, pt.payments.methods)
  ).toBe('Dinheiro');
});
it('ranks only occurrences in the selected period and groups unknown methods', (): void => {
  const base: Transaction = {
    id: 'rent',
    category: {
      id: 'category',
      name: 'Rent',
      transactionType: TransactionType.EXPENSE,
    },
    date: '2026/10/01',
    repeats: RepeatInterval.MONTHLY,
    totalValue: 100,
    paymentMethod: PaymentMethod.BOLETO,
    account: { id: 'account', name: 'Bradesco', bank: Bank.BRADESCO },
    months: [
      { month: '2026-11', skipped: false, amount: 120, date: '2026/11/05' },
    ],
  };
  const range = {
    startDate: new Date(2026, 10, 1),
    endDate: new Date(2026, 10, 30),
  };
  const transactions = [
    base,
    {
      ...base,
      id: 'unknown',
      repeats: RepeatInterval.NONE,
      date: '2026/11/01',
      totalValue: 80,
      paymentMethod: null,
      account: null,
    },
  ];
  expect(
    paymentRanking(transactions, range, en.payments.methods, 'Not set')
  ).toEqual([
    { label: 'Boleto', amount: 120, share: 60 },
    { label: 'Not set', amount: 80, share: 40 },
  ]);
  expect(
    paymentRanking(transactions, range, en.payments.methods, 'Not set', {
      card: 'Card',
      account: 'Account',
    })[0]?.label
  ).toBe('Account · Bradesco');
});
