'use client';

import { useI18n } from '@/i18n/useI18n';
import { getProjectedTransactionTotal } from '@/utils/transactionProjection.util';
import type { Transaction } from '@/types';
import { PieChart, type ChartsLegendSlotProps } from '@mui/x-charts';
import { useMemo, type JSX } from 'react';

interface PieChartDataType {
  id: string;
  value: number;
  label: string;
}

interface BalancePieChartProps {
  transactions: Transaction[];
  typography: string;
  startDate: Date;
  endDate: Date;
  height?: number;
  width?: number;
}

export default function BalancePieChart({
  transactions,
  typography,
  startDate,
  endDate,
  height = 180,
  width = 180,
}: Readonly<BalancePieChartProps>): JSX.Element {
  const { t } = useI18n();

  const groupedTransactions: PieChartDataType[] =
    useMemo((): PieChartDataType[] => {
      const grouped = Object.values(
        transactions.reduce(
          (
            accumulator: Partial<Record<string, PieChartDataType>>,
            transaction: Transaction
          ): Partial<Record<string, PieChartDataType>> => {
            const name = transaction.category.name;
            if (!accumulator[name]) {
              accumulator[name] = { id: name, label: name, value: 0 };
            }
            accumulator[name].value += getProjectedTransactionTotal(
              transaction,
              startDate,
              endDate
            );
            return accumulator;
          },
          {}
        )
      ).filter((transaction): transaction is PieChartDataType =>
        Boolean(transaction)
      );

      return grouped.sort(
        (firstData: PieChartDataType, secondData: PieChartDataType): number =>
          secondData.value - firstData.value
      );
    }, [transactions, startDate, endDate]);

  const darkColors: string[] = [
    'var(--ctp-blue)',
    'var(--ctp-mauve)',
    'var(--ctp-pink)',
    'var(--ctp-teal)',
    'var(--ctp-green)',
    'var(--ctp-yellow)',
    'var(--ctp-peach)',
    'var(--ctp-red)',
    'var(--ctp-maroon)',
    'var(--ctp-lavender)',
  ];

  return transactions.length ? (
    <div className="flex w-full flex-col items-center justify-center gap-2">
      {typography}
      <PieChart
        className="chart-container"
        colors={darkColors}
        series={[{ data: groupedTransactions }]}
        height={height}
        width={width}
        slotProps={{ legend: { hidden: true } } as ChartsLegendSlotProps}
      />
    </div>
  ) : (
    <div className="flex h-full w-full items-center justify-center text-[var(--ctp-subtext1)]">
      <span>{t.home.noData}</span>
    </div>
  );
}
