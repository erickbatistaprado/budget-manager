import { type Bank, PaymentMethod } from '@budget-manager/api-client';
import {
  projectOccurrences,
  type AnalyticsRange,
  type RankedAmount,
} from '@/utils/analytics.util';
import type { Transaction } from '@/types';
export const bankColors: Partial<Record<Bank, string>> = {
  NUBANK: '#8a05be',
  ITAU: '#ec7000',
  BRADESCO: '#cc092f',
  BANCO_DO_BRASIL: '#f8d117',
  CAIXA: '#0070ae',
  SANTANDER: '#ec0000',
  INTER: '#ff7a00',
  C6: '#242424',
};
export function supportsAccount(
  method: PaymentMethod | null | undefined,
  income: boolean
): boolean {
  if (!method || method === PaymentMethod.CREDIT_CARD) return false;
  return (
    income || (method !== PaymentMethod.CASH && method !== PaymentMethod.OTHER)
  );
}
export function paymentLabel(
  transaction: Pick<Transaction, 'paymentMethod' | 'card' | 'account'>,
  labels: Record<PaymentMethod, string>
): string {
  const method = transaction.paymentMethod;
  if (!method) return '';
  if (method === PaymentMethod.CREDIT_CARD && transaction.card)
    return `${labels.CREDIT_CARD} · ${transaction.card.name}`;
  if (transaction.account)
    return `${labels[method]} · ${transaction.account.name}`;
  return labels[method];
}

export function paymentRanking(
  transactions: Transaction[],
  range: AnalyticsRange,
  labels: Record<PaymentMethod, string>,
  unknown: string,
  instruments?: { card: string; account: string }
): RankedAmount[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    const amount = projectOccurrences([transaction], range).reduce(
      (total, occurrence): number => total + occurrence.amount,
      0
    );
    let label = transaction.paymentMethod
      ? labels[transaction.paymentMethod]
      : unknown;
    if (instruments && transaction.card) {
      label = `${instruments.card} · ${transaction.card.name}`;
    } else if (instruments && transaction.account) {
      label = `${instruments.account} · ${transaction.account.name}`;
    }
    totals.set(label, (totals.get(label) ?? 0) + amount);
  }
  const total = Array.from(totals.values()).reduce(
    (sum, amount): number => sum + amount,
    0
  );
  return Array.from(totals, ([label, amount]): RankedAmount => ({
    label,
    amount,
    share: total > 0 ? (amount / total) * 100 : 0,
  }))
    .filter((item): boolean => item.amount > 0)
    .sort((left, right): number => right.amount - left.amount);
}
