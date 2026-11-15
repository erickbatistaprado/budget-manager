import type { Card } from '@budget-manager/api-client';
import type { Transaction } from '@/types';
import { parseApiDate } from '@/utils/globalFormats.util';

function clampedDate(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

export function cardBillDueDate(
  purchase: Date,
  card: Pick<Card, 'closingDay' | 'dueDay'>
): Date {
  let month = purchase.getMonth();
  const year = purchase.getFullYear();
  let closing = clampedDate(year, month, card.closingDay);
  const purchaseDay = new Date(year, month, purchase.getDate());
  if (purchaseDay > closing) {
    month += 1;
    closing = clampedDate(year, month, card.closingDay);
  }
  let due = clampedDate(year, month, card.dueDay);
  if (due <= closing) {
    due = clampedDate(year, month + 1, card.dueDay);
  }
  return due;
}

export function nextCardDueDate(statementDate: Date, dueDay: number): Date {
  const due = clampedDate(
    statementDate.getFullYear(),
    statementDate.getMonth(),
    dueDay
  );
  if (due > statementDate) {
    return due;
  }
  return clampedDate(
    statementDate.getFullYear(),
    statementDate.getMonth() + 1,
    dueDay
  );
}

export function transactionBudgetDate(transaction: Transaction): Date {
  if (transaction.repeats === 'NONE' && !transaction.installmentNumbers) {
    return parseApiDate(transaction.billDueDate ?? transaction.date);
  }
  return parseApiDate(transaction.date);
}
