import { transactionBudgetDate } from '@/utils/cardBill.util';
import { monthlyOccurrence } from '@/utils/monthlyTransaction.util';
import type { Installment, Transaction } from '@/types';
import { parseApiDate, roundNumbersUp } from '@/utils/globalFormats.util';

function sameMonth(date: Date, other: Date): boolean {
  return (
    date.getMonth() === other.getMonth() &&
    date.getFullYear() === other.getFullYear()
  );
}

/** Installments due in the month of `date`; several after an early payment. */
export function installmentsInMonth(
  transaction: Transaction,
  date: Date
): Installment[] {
  return (transaction.installments ?? [])
    .filter((installment: Installment): boolean =>
      sameMonth(parseApiDate(installment.dueDate), date)
    )
    .sort(
      (left: Installment, right: Installment): number =>
        left.installmentNumber - right.installmentNumber
    );
}

/** What the transaction costs in the month of `date`. */
export function amountInMonth(transaction: Transaction, date: Date): number {
  if (transaction.repeats === 'MONTHLY') {
    return monthlyOccurrence(transaction, date)?.amount ?? 0;
  }
  const due: Installment[] = installmentsInMonth(transaction, date);
  if (due.length) {
    return due.reduce(
      (sum: number, installment: Installment): number =>
        sum + Number(installment.amount),
      0
    );
  }
  if (transaction.installmentNumbers) {
    return roundNumbersUp(
      transaction.totalValue,
      transaction.installmentNumbers
    );
  }
  if (
    transaction.repeats === 'NONE' &&
    !sameMonth(transactionBudgetDate(transaction), date)
  ) {
    return 0;
  }
  return transaction.totalValue;
}

/** `(3/8)`, or `(7–8/8)` when several installments fall in the month. */
export function describeInstallments(
  transaction: Transaction,
  date: Date
): string {
  if (!transaction.installmentNumbers) {
    return '';
  }
  const numbers: number[] = installmentsInMonth(transaction, date).map(
    (installment: Installment): number => installment.installmentNumber
  );
  if (!numbers.length) {
    return `(?/${transaction.installmentNumbers})`;
  }
  const first: number = numbers[0] ?? 0;
  const last: number = numbers[numbers.length - 1] ?? first;
  let range: string = numbers.join(', ');
  if (numbers.length === 1) {
    range = `${first}`;
  } else if (numbers.length === last - first + 1) {
    range = `${first}–${last}`;
  }
  return `(${range}/${transaction.installmentNumbers})`;
}

/** `2026-10-02` from a date input becomes `2026/10/02` for the API. */
export function toApiDate(isoDate: string): string {
  return isoDate.replaceAll('-', '/');
}

/** Today as a date input value, in the browser's time zone. */
export function todayInputValue(now: Date = new Date()): string {
  const month: string = String(now.getMonth() + 1).padStart(2, '0');
  const day: string = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
