import type { Financing } from '@budget-manager/api-client';
import type { Transaction } from '@/types';
import { financingSummary } from '@/utils/financing.util';
import { parseApiDate } from '@/utils/globalFormats.util';

export interface OwedOnCard {
  card: string;
  amount: number;
  installments: number;
}

export interface OwedOnFinancing {
  id: string;
  name: string;
  outstanding: number;
  remainingPayments: number;
  installments: number;
}

export interface StillOwed {
  cards: OwedOnCard[];
  financings: OwedOnFinancing[];
  total: number;
}

function startOfDay(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

/**
 * What is still owed: card installments not yet due (their bills are not paid) and, for each
 * financing, the outstanding balance plus what the remaining installments add up to. The total
 * counts the financings by their outstanding balance, which is what paying them off today costs.
 */
export function stillOwed(
  expenses: readonly Transaction[],
  financings: readonly Financing[],
  today: Date
): StillOwed {
  const from = startOfDay(today);
  const byCard = new Map<string, OwedOnCard>();
  const seen = new Set<string>();
  for (const expense of expenses) {
    if (
      seen.has(expense.id) ||
      expense.source === 'FINANCING' ||
      !expense.card ||
      !expense.installments?.length
    ) {
      continue;
    }
    seen.add(expense.id);
    const pending = expense.installments.filter(
      (installment): boolean =>
        parseApiDate(installment.dueDate).getTime() >= from
    );
    if (!pending.length) {
      continue;
    }
    const owed = byCard.get(expense.card.id) ?? {
      card: expense.card.name,
      amount: 0,
      installments: 0,
    };
    owed.amount += pending.reduce(
      (total, installment): number => total + installment.amount,
      0
    );
    owed.installments += pending.length;
    byCard.set(expense.card.id, owed);
  }
  const owedFinancings = financings
    .map((financing): OwedOnFinancing => {
      const unpaid = financing.calculation.schedule.filter(
        (row): boolean =>
          row.paidAmount === null || row.paidAmount === undefined
      );
      return {
        id: financing.id,
        name: financing.contract.name,
        outstanding: financingSummary(
          financing.calculation.schedule,
          financing.extraPaid,
          financing.payoffDate
        ).outstanding,
        remainingPayments: unpaid.reduce(
          (total, row): number => total + row.payment,
          0
        ),
        installments: unpaid.length,
      };
    })
    .filter((financing): boolean => financing.installments > 0);
  const cards = [...byCard.values()].sort(
    (first, second): number => second.amount - first.amount
  );
  return {
    cards,
    financings: owedFinancings,
    total:
      cards.reduce((total, card): number => total + card.amount, 0) +
      owedFinancings.reduce(
        (total, financing): number => total + financing.outstanding,
        0
      ),
  };
}
