'use client';

import { Panel } from '@/components/ui';
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
    <Panel className="flex w-full cursor-default items-center justify-start shadow-md">
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
    </Panel>
  );
}
