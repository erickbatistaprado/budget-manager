import { transactionBudgetDate } from '@/utils/cardBill.util';
import { monthlyOccurrence } from '@/utils/monthlyTransaction.util';
import { RepeatInterval } from '@/enums';
import type { Installment, Transaction } from '@/types';
import { parseApiDate } from '@/utils/globalFormats.util';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isBetween(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

function totalInstallmentsInRange(
  installments: Installment[],
  startDate: Date,
  endDate: Date
): number {
  return installments.reduce(
    (sum: number, installment: Installment): number => {
      const dueDate = parseApiDate(installment.dueDate);

      if (!isBetween(dueDate, startDate, endDate)) {
        return sum;
      }

      return sum + Number(installment.amount);
    },
    0
  );
}

export function getProjectedTransactionTotal(
  transaction: Transaction,
  startDate: Date,
  endDate: Date
): number {
  if (transaction.installments?.length) {
    return totalInstallmentsInRange(
      transaction.installments,
      startDate,
      endDate
    );
  }

  const transactionDate = transactionBudgetDate(transaction);

  if (transaction.repeats === RepeatInterval.MONTHLY) {
    let total = 0;
    let month = startOfMonth(startDate);
    while (month <= endDate) {
      const occurrence = monthlyOccurrence(transaction, month);
      if (occurrence && isBetween(occurrence.date, startDate, endDate)) {
        total += occurrence.amount;
      }
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    }
    return total;
  }

  if (!isBetween(transactionDate, startDate, endDate)) {
    return 0;
  }

  return Number(transaction.totalValue);
}

export function getProjectedTransactionsTotal(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): number {
  return transactions.reduce(
    (sum: number, transaction: Transaction): number =>
      sum + getProjectedTransactionTotal(transaction, startDate, endDate),
    0
  );
}
