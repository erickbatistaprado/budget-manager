'use client';

import { BalanceBarChart, BalancePieChart } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '@/types';
import type { JSX } from 'react';

interface ChartsProps {
  expenses: Transaction[];
  incomes: Transaction[];
  startDate: Date;
  endDate: Date;
}

export default function Charts({
  expenses,
  incomes,
  startDate,
  endDate,
}: Readonly<ChartsProps>): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="flex w-full cursor-default items-center justify-start rounded border border-[var(--ctp-surface1)] bg-[var(--ctp-surface0)]/90 p-2 shadow-md">
      <BalanceBarChart
        startDate={startDate}
        endDate={endDate}
        expenses={expenses}
        incomes={incomes}
      />
      <BalancePieChart
        startDate={startDate}
        endDate={endDate}
        transactions={incomes}
        typography={t.home.incomes}
      />
      <BalancePieChart
        startDate={startDate}
        endDate={endDate}
        transactions={expenses}
        typography={t.home.expenses}
      />
    </div>
  );
}
