import type { Transaction } from '@/types';
import { parseApiDate } from '@/utils/globalFormats.util';

export interface MonthlyOccurrence {
  amount: number;
  date: Date;
  notes: string | null | undefined;
  changed: boolean;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthlyOccurrence(
  transaction: Transaction,
  month: Date
): MonthlyOccurrence | null {
  const origin = parseApiDate(transaction.date);
  const key = monthKey(month);
  if (
    key < monthKey(origin) ||
    (transaction.repeatUntil &&
      key > monthKey(parseApiDate(transaction.repeatUntil)))
  ) {
    return null;
  }
  const override = transaction.months?.find(
    (change): boolean => change.month === key
  );
  if (override?.skipped) {
    return null;
  }
  const lastDay = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();
  const date = override?.date
    ? parseApiDate(override.date)
    : new Date(
        month.getFullYear(),
        month.getMonth(),
        Math.min(origin.getDate(), lastDay)
      );
  return {
    amount: override?.amount ?? transaction.totalValue,
    date,
    notes: override ? override.notes : transaction.notes,
    changed: Boolean(override),
  };
}
