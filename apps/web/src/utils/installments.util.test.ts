import type { Installment, Transaction } from '@/types';
import {
  amountInMonth,
  describeInstallments,
  installmentsInMonth,
  toApiDate,
  todayInputValue,
} from './installments.util';

function installment(
  installmentNumber: number,
  dueDate: string,
  paidEarly = false
): Installment {
  return {
    id: `i${installmentNumber}`,
    installmentNumber,
    totalInstallments: 8,
    amount: 100,
    dueDate,
    paidEarly,
  };
}

const purchase: Transaction = {
  id: 't1',
  category: {
    id: 'c1',
    name: 'Health',
    transactionType: 'EXPENSE',
  } as Transaction['category'],
  notes: 'Dental Clinic',
  totalValue: 800,
  installmentNumbers: 8,
  repeats: 'NONE' as Transaction['repeats'],
  date: '2026/03/30',
  installments: [
    installment(6, '2026/09/30'),
    installment(8, '2026/10/02', true),
    installment(7, '2026/10/02', true),
  ],
};

describe('installment helpers', (): void => {
  it('finds every installment due in the month, in order', (): void => {
    expect(
      installmentsInMonth(purchase, new Date(2026, 9, 15)).map(
        (due: Installment): number => due.installmentNumber
      )
    ).toEqual([7, 8]);
  });

  it('adds up all installments due in the month', (): void => {
    expect(amountInMonth(purchase, new Date(2026, 9, 1))).toBe(200);
    expect(amountInMonth(purchase, new Date(2026, 8, 1))).toBe(100);
  });

  it('describes the installments of the month', (): void => {
    expect(describeInstallments(purchase, new Date(2026, 9, 1))).toBe(
      '(7–8/8)'
    );
    expect(describeInstallments(purchase, new Date(2026, 8, 1))).toBe('(6/8)');
  });

  it('converts dates for the API and the date input', (): void => {
    expect(toApiDate('2026-10-02')).toBe('2026/10/02');
    expect(todayInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
