import type {
  Evolution,
  PaymentMethod,
  Movement,
  MovementDraft,
} from '@budget-manager/api-client';
import { paymentLabel } from '@/utils/payment.util';
import type { Transaction } from '@/types';
import { amountInMonth, installmentsInMonth } from '@/utils/installments.util';
import { monthlyOccurrence } from '@/utils/monthlyTransaction.util';
import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';
export interface Entry {
  key: string;
  type: 'income' | 'expenses' | 'movements';
  amount: number;
  date: number;
  search: string;
  description?: string;
  category: string;
  payment: string[];
  unassigned: boolean;
  transaction?: Transaction;
  movement?: Movement;
}
export interface Filters {
  search: string;
  type: string;
  category: string;
  payment: string;
  unassigned: boolean;
  sort?: 'date' | 'amount' | 'description' | 'category' | 'payment';
  direction?: 'asc' | 'desc';
  minimum?: string;
  maximum?: string;
  from?: string;
  until?: string;
}
export function transactionEntry(
  transaction: Transaction,
  type: 'income' | 'expenses',
  month: Date,
  paymentLabels?: Record<PaymentMethod, string>
): Entry {
  const occurrence =
    transaction.repeats === 'MONTHLY'
      ? monthlyOccurrence(transaction, month)
      : null;
  const date =
    occurrence?.date ??
    parseApiDate(
      installmentsInMonth(transaction, month)[0]?.dueDate ??
        transaction.billDueDate ??
        transaction.date
    );
  return {
    key: transaction.id,
    type,
    amount: amountInMonth(transaction, month),
    date: date.getTime(),
    search: [
      transaction.category.name,
      occurrence?.notes ?? transaction.notes,
      transaction.card?.name,
      transaction.account?.name,
      paymentLabels
        ? paymentLabel(transaction, paymentLabels)
        : transaction.paymentMethod,
    ]
      .filter(Boolean)
      .join(' '),
    description:
      occurrence?.notes || transaction.notes || transaction.category.name,
    category: transaction.category.name,
    payment: [
      paymentLabels
        ? paymentLabel(transaction, paymentLabels)
        : transaction.paymentMethod,
      transaction.card?.name,
      transaction.account?.name,
    ].filter((value): value is string => Boolean(value)),
    unassigned:
      !transaction.accountId &&
      !transaction.account &&
      !transaction.cardId &&
      !transaction.card &&
      transaction.paymentMethod !== 'CREDIT_CARD',
    transaction,
  };
}
export function filterEntries(entries: Entry[], filters: Filters): Entry[] {
  const query = filters.search.trim().toLocaleLowerCase();
  return entries
    .filter(
      (entry): boolean =>
        (!query || entry.search.toLocaleLowerCase().includes(query)) &&
        (filters.type === 'all' || entry.type === filters.type) &&
        (!filters.category || entry.category === filters.category) &&
        (!filters.payment || entry.payment.includes(filters.payment)) &&
        (!filters.unassigned || entry.unassigned) &&
        (!filters.minimum || entry.amount >= Number(filters.minimum)) &&
        (!filters.maximum || entry.amount <= Number(filters.maximum)) &&
        (!filters.from ||
          entry.date >= new Date(`${filters.from}T00:00:00`).getTime()) &&
        (!filters.until ||
          entry.date <= new Date(`${filters.until}T23:59:59.999`).getTime())
    )
    .sort((left, right): number => {
      let comparison: number;
      switch (filters.sort ?? 'date') {
        case 'amount':
          comparison = left.amount - right.amount;
          break;
        case 'description':
          comparison = (
            left.description ??
            left.transaction?.notes ??
            left.movement?.notes ??
            ''
          ).localeCompare(
            right.description ??
              right.transaction?.notes ??
              right.movement?.notes ??
              ''
          );
          break;
        case 'category':
          comparison = left.category.localeCompare(right.category);
          break;
        case 'payment':
          comparison = left.payment
            .join(' ')
            .localeCompare(right.payment.join(' '));
          break;
        default:
          comparison = left.date - right.date;
      }
      return (
        comparison * (filters.direction === 'asc' ? 1 : -1) ||
        left.key.localeCompare(right.key)
      );
    });
}
export function filteredTotals(
  entries: Entry[]
): Record<Entry['type'], number> {
  return entries.reduce(
    (totals, entry): Record<Entry['type'], number> => ({
      ...totals,
      [entry.type]: totals[entry.type] + entry.amount,
    }),
    { income: 0, expenses: 0, movements: 0 }
  );
}
export function investmentDraft(
  kept: number,
  incomes: Entry[],
  month: Date,
  today = new Date(),
  mainAccountId?: string | null
): Partial<MovementDraft> {
  const byAccount = new Map<string, number>();
  incomes.forEach((entry): void => {
    const account =
      entry.transaction?.accountId ?? entry.transaction?.account?.id;
    if (account)
      byAccount.set(account, (byAccount.get(account) ?? 0) + entry.amount);
  });
  const main = [...byAccount.entries()].sort(
    (left, right): number => right[1] - left[1]
  )[0]?.[0];
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return {
    kind: 'INVESTMENT',
    amount: kept,
    fromAccountId: mainAccountId ?? main,
    date: getApiDate(end < today ? end : today),
  };
}
export function evolutionData(
  rows: Evolution[],
  all: boolean
): {
  months: string[];
  positive: number[];
  negative: number[];
  invested: number[];
  netWorth: number[];
} {
  const selected = all ? rows : rows.slice(-12);
  return {
    months: selected.map((row): string => row.month),
    positive: selected.map((row): number => Math.max(0, row.surplus)),
    negative: selected.map((row): number => Math.min(0, row.surplus)),
    invested: selected.map((row): number => row.invested),
    netWorth: selected.map((row): number => row.netWorth),
  };
}

export function accountOutflows(entries: Entry[]): Record<string, number> {
  const flows: Record<string, number> = {};
  function add(id: string | null | undefined, amount: number): void {
    if (id) flows[id] = (flows[id] ?? 0) + amount;
  }
  entries.forEach((entry): void => {
    if (
      entry.transaction &&
      entry.transaction.paymentMethod !== 'CREDIT_CARD' &&
      !entry.transaction.card
    )
      add(
        entry.transaction.accountId ?? entry.transaction.account?.id,
        entry.type === 'income' ? entry.amount : -entry.amount
      );
    if (entry.movement) {
      add(entry.movement.fromAccountId, -entry.amount);
      add(entry.movement.toAccountId, entry.amount);
    }
  });
  return Object.fromEntries(
    Object.entries(flows)
      .filter(([, amount]): boolean => amount < 0)
      .map(([id, amount]): [string, number] => [id, -amount])
  );
}
