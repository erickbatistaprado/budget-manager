import type { FinancingRow } from '@budget-manager/api-client';
export interface FinancingSummary {
  outstanding: number;
  paid: number;
  interestPaid: number;
  remainingInterest: number;
  paidCount: number;
  payoff: string | undefined;
}
export function financingSummary(
  rows: readonly FinancingRow[],
  extraPaid: number = 0,
  payoffDate?: string
): FinancingSummary {
  const paidRows = rows.filter(
    (row): boolean => row.paidAmount !== null && row.paidAmount !== undefined
  );
  const outstanding = rows
    .filter(
      (row): boolean => row.paidAmount === null || row.paidAmount === undefined
    )
    .reduce((total, row): number => total + row.principal, 0);
  return {
    outstanding: Math.max(0, outstanding),
    paid:
      extraPaid +
      paidRows.reduce((total, row): number => total + (row.paidAmount ?? 0), 0),
    interestPaid: paidRows.reduce(
      (total, row): number => total + row.interest,
      0
    ),
    remainingInterest: rows
      .filter(
        (row): boolean =>
          row.paidAmount === null || row.paidAmount === undefined
      )
      .reduce((total, row): number => total + row.interest, 0),
    paidCount: paidRows.length,
    payoff: payoffDate ?? rows.at(-1)?.dueDate,
  };
}
