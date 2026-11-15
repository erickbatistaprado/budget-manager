'use client';

import { RepeatInterval } from '@/enums';
import { useI18n } from '@/i18n/useI18n';
import type { Installment, Transaction } from '@/types';
import { parseApiDate } from '@/utils/globalFormats.util';
import { BarChart } from '@mui/x-charts';
import { addMonths, format, startOfMonth, type Locale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { ptBR } from 'date-fns/locale/pt-BR';
import { type JSX, useMemo } from 'react';

interface MonthlyBalance {
  month: string;
  income: number;
  expense: number;
}

interface ExpandTransaction {
  month: string;
  amount: number;
}

interface BalanceBarChartProps {
  expenses: Transaction[];
  incomes: Transaction[];
  startDate: Date;
  endDate: Date;
  height?: number;
  width?: number;
}

function expandTransaction(
  transaction: Transaction,
  startDate: Date,
  endDate: Date,
  locale: Locale
): ExpandTransaction[] {
  if (transaction.installments && transaction.installments.length > 0) {
    return transaction.installments
      .filter(({ dueDate }: Installment): boolean => {
        const parsedDueDate = parseApiDate(dueDate);
        return parsedDueDate >= startDate && parsedDueDate <= endDate;
      })
      .map(({ amount, dueDate }: Installment): ExpandTransaction => ({
        month: format(startOfMonth(parseApiDate(dueDate)), 'MMM yyyy', {
          locale,
        }),
        amount: Number(amount),
      }));
  }
  if (transaction.repeats === RepeatInterval.MONTHLY) {
    const results: ExpandTransaction[] = [];
    let current: Date = startOfMonth(
      new Date(
        Math.max(parseApiDate(transaction.date).getTime(), startDate.getTime())
      )
    );

    while (current <= endDate) {
      results.push({
        month: format(current, 'MMM yyyy', { locale }),
        amount: Number(transaction.totalValue),
      });
      current = addMonths(current, 1);
    }
    return results;
  }
  return [
    {
      month: format(startOfMonth(parseApiDate(transaction.date)), 'MMM yyyy', {
        locale,
      }),
      amount: Number(transaction.totalValue),
    },
  ];
}

function generateMonthsInRange(
  start: Date,
  end: Date,
  locale: Locale
): string[] {
  const months: string[] = [];
  let current: Date = startOfMonth(start);

  while (current <= end) {
    months.push(format(current, 'MMM yyyy', { locale }));
    current = addMonths(current, 1);
  }
  return months;
}

export default function BalanceBarChart({
  expenses,
  incomes,
  startDate,
  endDate,
  height = 170,
  width = 200,
}: Readonly<BalanceBarChartProps>): JSX.Element {
  const { language, t } = useI18n();
  const dateLocale: Locale = language === 'pt' ? ptBR : enUS;

  const chartData: MonthlyBalance[] = useMemo((): MonthlyBalance[] => {
    const months: string[] = generateMonthsInRange(
      startDate,
      endDate,
      dateLocale
    );
    const monthly: Partial<Record<string, MonthlyBalance>> = {};

    for (const monthName of months) {
      monthly[monthName] = { month: monthName, income: 0, expense: 0 };
    }
    for (const income of incomes) {
      for (const { amount, month } of expandTransaction(
        income,
        startDate,
        endDate,
        dateLocale
      )) {
        if (!monthly[month]) {
          continue;
        }
        monthly[month].income += amount;
      }
    }
    for (const expense of expenses) {
      for (const { amount, month } of expandTransaction(
        expense,
        startDate,
        endDate,
        dateLocale
      )) {
        if (!monthly[month]) {
          continue;
        }
        monthly[month].expense += amount;
      }
    }
    return Object.values(monthly).filter((balance): balance is MonthlyBalance =>
      Boolean(balance)
    );
  }, [expenses, incomes, startDate, endDate, dateLocale]);

  return (
    <div className="w-full">
      <BarChart
        xAxis={[
          {
            data: chartData.map(({ month }: MonthlyBalance): string => month),
            scaleType: 'band',
          },
        ]}
        series={[
          {
            data: chartData.map(({ income }: MonthlyBalance): number => income),
            label: t.home.incomes,
          },
          {
            data: chartData.map(
              ({ expense }: MonthlyBalance): number => expense
            ),
            label: t.home.expenses,
          },
        ]}
        height={height}
        width={width}
      />
    </div>
  );
}
