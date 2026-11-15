import { RepeatInterval, SavingLocation } from '@/enums';
import type { Saving, Transaction } from '@/types';
import { parseApiDate } from '@/utils/globalFormats.util';
import { getProjectedTransactionTotal } from '@/utils/transactionProjection.util';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  type Locale,
} from 'date-fns';

export type PeriodKind = 'week' | 'month' | 'year' | 'custom';
export interface AnalyticsRange {
  startDate: Date;
  endDate: Date;
}
export interface PeriodSelection {
  kind: PeriodKind;
  anchor: string;
  start: string;
  end: string;
}
export interface Occurrence {
  date: Date;
  amount: number;
  category: string;
  merchant: string;
  committed: boolean;
  installment: boolean;
}
export interface Figures {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  dailyAverage: number;
}
export interface RankedAmount {
  label: string;
  amount: number;
  share: number;
}
export interface Budget {
  income: number;
  estimated: boolean;
  spent: number;
  committed: number;
  left: number;
  days: number;
  daily: number;
  spentShare: number;
}
export interface Bucket {
  label: string;
  income: number;
  expenses: number;
  daily: number;
  cumulativeIncome: number;
  cumulativeExpenses: number;
}

export function periodRange(
  kind: PeriodKind,
  anchor: Date,
  custom?: AnalyticsRange
): AnalyticsRange {
  if (kind === 'custom' && custom) {
    return {
      startDate: startOfDay(custom.startDate),
      endDate: startOfDay(custom.endDate),
    };
  }
  if (kind === 'week') {
    return {
      startDate: startOfWeek(anchor, { weekStartsOn: 1 }),
      endDate: startOfDay(endOfWeek(anchor, { weekStartsOn: 1 })),
    };
  }
  if (kind === 'year') {
    return {
      startDate: startOfYear(anchor),
      endDate: startOfDay(endOfYear(anchor)),
    };
  }
  return {
    startDate: startOfMonth(anchor),
    endDate: startOfDay(endOfMonth(anchor)),
  };
}
export function rangeDays(range: AnalyticsRange): number {
  return Math.max(
    0,
    differenceInCalendarDays(range.endDate, range.startDate) + 1
  );
}
export function validRange(range: AnalyticsRange): boolean {
  return (
    Number.isFinite(range.startDate.getTime()) &&
    Number.isFinite(range.endDate.getTime()) &&
    rangeDays(range) > 0
  );
}
export function previousRange(range: AnalyticsRange): AnalyticsRange {
  return {
    startDate: addDays(range.startDate, -rangeDays(range)),
    endDate: addDays(range.startDate, -1),
  };
}
export function stepPeriod(
  kind: PeriodKind,
  anchor: Date,
  direction: number
): Date {
  if (kind === 'week') {
    return addWeeks(anchor, direction);
  }
  if (kind === 'year') {
    return addYears(anchor, direction);
  }
  return addMonths(anchor, direction);
}
export function restoreSelection(
  value: string | null
): PeriodSelection | undefined {
  try {
    const selection: unknown = JSON.parse(value ?? 'null');
    if (typeof selection !== 'object' || selection === null) {
      return undefined;
    }
    if (
      !('kind' in selection) ||
      !['week', 'month', 'year', 'custom'].includes(String(selection.kind))
    ) {
      return undefined;
    }
    if (
      !('anchor' in selection) ||
      !('start' in selection) ||
      !('end' in selection)
    ) {
      return undefined;
    }
    const { anchor, start, end } = selection;
    if (
      ![anchor, start, end].every(
        (date): boolean =>
          typeof date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          Number.isFinite(parseApiDate(date).getTime()) &&
          format(parseApiDate(date), 'yyyy-MM-dd') === date
      )
    ) {
      return undefined;
    }
    return selection as PeriodSelection;
  } catch {
    return undefined;
  }
}

/** Expand repeats from their original day, clamping month/year ends without drifting. */
export function projectOccurrences(
  transactions: Transaction[],
  range: AnalyticsRange
): Occurrence[] {
  if (!validRange(range)) {
    return [];
  }
  const results: Occurrence[] = [];
  for (const transaction of transactions) {
    const base = {
      category: transaction.category.name,
      merchant: transaction.notes?.trim() ?? '',
      committed:
        transaction.repeats !== RepeatInterval.NONE ||
        Boolean(transaction.installments?.length),
      installment: Boolean(transaction.installments?.length),
    };
    if (transaction.installments?.length) {
      for (const installment of transaction.installments) {
        const date = parseApiDate(installment.dueDate);
        if (date >= range.startDate && date <= range.endDate) {
          results.push({
            ...base,
            date,
            amount: getProjectedTransactionTotal(
              { ...transaction, installments: [installment] },
              date,
              date
            ),
          });
        }
      }
      continue;
    }
    const origin = parseApiDate(transaction.date);
    if (transaction.repeats === RepeatInterval.NONE) {
      if (origin >= range.startDate && origin <= range.endDate) {
        results.push({
          ...base,
          date: origin,
          amount: getProjectedTransactionTotal(
            transaction,
            range.startDate,
            range.endDate
          ),
        });
      }
      continue;
    }
    let index = 0;
    if (transaction.repeats === RepeatInterval.DAILY) {
      index = Math.max(0, differenceInCalendarDays(range.startDate, origin));
    }
    if (transaction.repeats === RepeatInterval.WEEKLY) {
      index = Math.max(
        0,
        Math.floor(differenceInCalendarDays(range.startDate, origin) / 7)
      );
    }
    if (transaction.repeats === RepeatInterval.MONTHLY) {
      index = Math.max(0, differenceInCalendarMonths(range.startDate, origin));
    }
    if (transaction.repeats === RepeatInterval.YEARLY) {
      index = Math.max(0, differenceInCalendarYears(range.startDate, origin));
    }
    function occurrenceDate(offset: number): Date {
      if (transaction.repeats === RepeatInterval.DAILY) {
        return addDays(origin, offset);
      }
      if (transaction.repeats === RepeatInterval.WEEKLY) {
        return addWeeks(origin, offset);
      }
      if (transaction.repeats === RepeatInterval.YEARLY) {
        return addYears(origin, offset);
      }
      return addMonths(origin, offset);
    }
    let date = occurrenceDate(index);
    while (date <= range.endDate) {
      if (date >= range.startDate) {
        const single = {
          ...transaction,
          date: format(date, 'yyyy/MM/dd'),
          repeats: RepeatInterval.NONE,
        };
        results.push({
          ...base,
          date,
          amount: getProjectedTransactionTotal(single, date, date),
        });
      }
      index += 1;
      date = occurrenceDate(index);
    }
  }
  return results;
}
export function sumOccurrences(
  occurrences: Occurrence[],
  range: AnalyticsRange,
  committedOnly = false
): number {
  return occurrences.reduce((total, occurrence): number => {
    if (
      occurrence.date < range.startDate ||
      occurrence.date > range.endDate ||
      (committedOnly && !occurrence.committed)
    ) {
      return total;
    }
    return total + occurrence.amount;
  }, 0);
}
export function averageDays(range: AnalyticsRange, today: Date): number {
  const day = startOfDay(today);
  if (day >= range.startDate && day <= range.endDate) {
    return differenceInCalendarDays(day, range.startDate) + 1;
  }
  return rangeDays(range);
}
export function keyFigures(
  incomes: Occurrence[],
  expenses: Occurrence[],
  range: AnalyticsRange,
  today: Date
): Figures {
  const income = sumOccurrences(incomes, range);
  const expense = sumOccurrences(expenses, range);
  const net = income - expense;
  return {
    income,
    expenses: expense,
    net,
    savingsRate: income > 0 ? (net / income) * 100 : 0,
    dailyAverage: expense / (averageDays(range, today) || 1),
  };
}
export function figureChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}
export function budgetPanels(
  incomes: Occurrence[],
  expenses: Occurrence[],
  today: Date
): { current: Budget; next: Budget } {
  const day = startOfDay(today);
  const currentRange = periodRange('month', day);
  const nextRange = periodRange('month', addMonths(day, 1));
  const income = sumOccurrences(incomes, currentRange);
  const spent = sumOccurrences(expenses, {
    startDate: currentRange.startDate,
    endDate: day,
  });
  const futureRange = {
    startDate: addDays(day, 1),
    endDate: currentRange.endDate,
  };
  const committed = sumOccurrences(expenses, futureRange, true);
  const left = income - spent - committed;
  const days = rangeDays(futureRange);
  const scheduledIncome = sumOccurrences(incomes, nextRange, true);
  // Average only the last 3 months that had income, so months before the
  // first recorded income do not pull the estimate down.
  const recentIncomes: number[] = [1, 2, 3]
    .map((offset: number): number =>
      sumOccurrences(incomes, periodRange('month', addMonths(day, -offset)))
    )
    .filter((amount: number): boolean => amount > 0);
  const historicalIncome: number = recentIncomes.reduce(
    (total: number, amount: number): number => total + amount,
    0
  );
  const hasScheduledIncome = incomes.some(
    (occurrence): boolean =>
      occurrence.committed &&
      occurrence.date >= nextRange.startDate &&
      occurrence.date <= nextRange.endDate
  );
  const nextIncome = hasScheduledIncome
    ? scheduledIncome
    : historicalIncome / (recentIncomes.length || 1);
  const nextCommitted = sumOccurrences(expenses, nextRange, true);
  const nextLeft = nextIncome - nextCommitted;
  return {
    current: {
      income,
      estimated: false,
      spent,
      committed,
      left,
      days,
      daily: days > 0 ? Math.max(0, left) / days : 0,
      spentShare: income > 0 ? (spent / income) * 100 : 0,
    },
    next: {
      income: nextIncome,
      estimated: !hasScheduledIncome,
      spent: 0,
      committed: nextCommitted,
      left: nextLeft,
      days: rangeDays(nextRange),
      daily: Math.max(0, nextLeft) / rangeDays(nextRange),
      spentShare: 0,
    },
  };
}
export function rankExpenses(
  expenses: Occurrence[],
  range: AnalyticsRange,
  field: 'category' | 'merchant',
  fallback: string
): RankedAmount[] {
  const totals = new Map<string, number>();
  const total = sumOccurrences(expenses, range);
  for (const expense of expenses) {
    if (expense.date < range.startDate || expense.date > range.endDate) {
      continue;
    }
    const label = expense[field] || fallback;
    totals.set(label, (totals.get(label) ?? 0) + expense.amount);
  }
  return Array.from(totals, ([label, amount]): RankedAmount => ({
    label,
    amount,
    share: total > 0 ? (amount / total) * 100 : 0,
  }))
    .filter((item): boolean => item.amount > 0)
    .sort((left, right): number => right.amount - left.amount);
}
export function chartBuckets(
  incomes: Occurrence[],
  expenses: Occurrence[],
  range: AnalyticsRange,
  dateLocale?: Locale
): Bucket[] {
  if (!validRange(range)) {
    return [];
  }
  const days = rangeDays(range);
  const buckets: Bucket[] = [];
  let cursor = range.startDate;
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;
  while (cursor <= range.endDate) {
    let next = addDays(cursor, 1);
    if (days > 45 && days <= 120) {
      next = addDays(cursor, 7);
    }
    if (days > 120) {
      next = addMonths(startOfMonth(cursor), 1);
    }
    const endDate = new Date(
      Math.min(addDays(next, -1).getTime(), range.endDate.getTime())
    );
    const bucketRange = { startDate: cursor, endDate };
    const income = sumOccurrences(incomes, bucketRange);
    const expense = sumOccurrences(expenses, bucketRange);
    cumulativeIncome += income;
    cumulativeExpenses += expense;
    let label = format(cursor, 'dd MMM', { locale: dateLocale });
    if (days > 120) {
      label = format(cursor, 'MMM yyyy', { locale: dateLocale });
    }
    if (days > 45 && days <= 120) {
      label = `${label} – ${format(endDate, 'dd MMM', { locale: dateLocale })}`;
    }
    buckets.push({
      label,
      income,
      expenses: expense,
      daily: expense / rangeDays(bucketRange),
      cumulativeIncome,
      cumulativeExpenses,
    });
    cursor = next;
  }
  return buckets;
}
export function installmentForecast(
  expenses: Occurrence[],
  today: Date,
  dateLocale?: Locale
): { labels: string[]; series: { label: string; data: number[] }[] } {
  const ranges = Array.from(
    { length: 6 },
    (_unusedValue, index): AnalyticsRange =>
      periodRange('month', addMonths(today, index + 1))
  );
  const categories = [
    ...new Set(
      expenses
        .filter((expense): boolean => expense.installment)
        .map((expense): string => expense.category)
    ),
  ];
  return {
    labels: ranges.map((range): string =>
      format(range.startDate, 'MMM yyyy', { locale: dateLocale })
    ),
    series: categories
      .map((category): { label: string; data: number[] } => ({
        label: category,
        data: ranges.map((range): number =>
          sumOccurrences(
            expenses.filter(
              (expense): boolean =>
                expense.installment && expense.category === category
            ),
            range
          )
        ),
      }))
      .filter((series): boolean =>
        series.data.some((amount): boolean => amount > 0)
      ),
  };
}
export function savingsSummary(savings: Saving[]): {
  total: number;
  locations: { location: SavingLocation; amount: number }[];
} {
  return {
    total: savings.reduce((total, saving): number => total + saving.amount, 0),
    locations: Object.values(SavingLocation).map(
      (location): { location: SavingLocation; amount: number } => ({
        location,
        amount: savings
          .filter((saving): boolean => saving.location === location)
          .reduce((total, saving): number => total + saving.amount, 0),
      })
    ),
  };
}
export function queryRange(
  selected: AnalyticsRange,
  today: Date
): AnalyticsRange {
  const previous = previousRange(selected);
  const history = startOfMonth(addMonths(today, -3));
  return {
    startDate: new Date(
      Math.min(previous.startDate.getTime(), history.getTime())
    ),
    endDate: new Date(
      Math.max(
        selected.endDate.getTime(),
        endOfMonth(addMonths(today, 6)).getTime()
      )
    ),
  };
}
function normalizeCurrencyLocale(locale?: string): string {
  if (locale === 'en' || locale === 'en-US') {
    return 'en-US';
  }
  return 'pt-BR';
}

export function formatBRL(
  value: number | null,
  locale: string = 'pt-BR'
): string {
  if (value === null) {
    return '';
  }
  return new Intl.NumberFormat(normalizeCurrencyLocale(locale), {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function dailyAllowance(income: number, range: AnalyticsRange): number {
  return Math.max(0, income) / (rangeDays(range) || 1);
}

export interface AnalyticsOverview {
  figures: Figures;
  previous: Figures;
  budgets: { current: Budget; next: Budget };
  buckets: Bucket[];
  categories: RankedAmount[];
  merchants: RankedAmount[];
  forecast: ReturnType<typeof installmentForecast>;
  allowance: number;
  hasActivity: boolean;
}
export function analyticsOverview(
  incomeTransactions: Transaction[],
  expenseTransactions: Transaction[],
  range: AnalyticsRange,
  today: Date,
  labels: { unknownCategory: string; unknownMerchant: string },
  dateLocale?: Locale
): AnalyticsOverview {
  const query = queryRange(range, today);
  const incomes = projectOccurrences(incomeTransactions, query);
  const expenses = projectOccurrences(expenseTransactions, query);
  const figures = keyFigures(incomes, expenses, range, today);
  return {
    figures,
    previous: keyFigures(incomes, expenses, previousRange(range), today),
    budgets: budgetPanels(incomes, expenses, today),
    buckets: chartBuckets(incomes, expenses, range, dateLocale),
    categories: rankExpenses(
      expenses,
      range,
      'category',
      labels.unknownCategory
    ),
    merchants: rankExpenses(
      expenses,
      range,
      'merchant',
      labels.unknownMerchant
    ).slice(0, 8),
    forecast: installmentForecast(expenses, today, dateLocale),
    allowance: dailyAllowance(figures.income, range),
    hasActivity: figures.income !== 0 || figures.expenses !== 0,
  };
}

export function formatCompactBRL(
  value: number | null,
  locale: string = 'pt-BR'
): string {
  if (value === null) {
    return '';
  }
  return new Intl.NumberFormat(normalizeCurrencyLocale(locale), {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
}

/** `64.1%` in English, `64,1%` in Portuguese; a sign when asked, for comparisons. */
export function formatPercent(
  value: number,
  language: string,
  signed = false
): string {
  const formatted: string = new Intl.NumberFormat(
    language.startsWith('pt') ? 'pt-BR' : 'en-US',
    {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: signed ? 'exceptZero' : 'auto',
    }
  ).format(value / 100);
  return formatted.replaceAll('\u00a0', ' ');
}
