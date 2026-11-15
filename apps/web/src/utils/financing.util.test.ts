import type { FinancingRow } from '@budget-manager/api-client';
import { financingSummary } from './financing.util';
const row: FinancingRow = {
  status: 'PAID',
  number: 1,
  dueDate: '2026/11/28',
  principal: 100,
  interest: 10,
  insurance: 2,
  fees: 1,
  payment: 113,
  balance: 100,
  paidAmount: 115,
};
it('counts actual paid amounts and extras while excluding paid principal from debt', (): void => {
  const summary = financingSummary(
    [
      row,
      {
        ...row,
        number: 2,
        dueDate: '2026/12/28',
        interest: 5,
        payment: 108,
        balance: 0,
        paidAmount: null,
      },
    ],
    50
  );
  expect(summary).toEqual({
    outstanding: 100,
    paid: 165,
    interestPaid: 10,
    remainingInterest: 5,
    paidCount: 1,
    payoff: '2026/12/28',
  });
});
it('handles a completely prepaid contract', (): void => {
  expect(financingSummary([]).outstanding).toBe(0);
  expect(financingSummary([]).payoff).toBeUndefined();
});
