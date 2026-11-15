import { RepeatInterval, SavingLocation, TransactionType } from '@/enums';
import type { Installment, Transaction } from '@/types';
import { parseApiDate } from './globalFormats.util';
import {
  formatPercent,
  type AnalyticsRange,
  type PeriodKind,
  analyticsOverview,
  averageDays,
  budgetPanels,
  chartBuckets,
  dailyAllowance,
  figureChange,
  formatBRL,
  formatCompactBRL,
  installmentForecast,
  keyFigures,
  periodRange,
  previousRange,
  projectOccurrences,
  queryRange,
  rangeDays,
  rankExpenses,
  restoreSelection,
  savingsSummary,
  stepPeriod,
  validRange,
} from './analytics.util';
import { format } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';

const today = parseApiDate('2026/11/14');
function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'purchase',
    category: {
      id: 'food',
      name: 'Food',
      transactionType: TransactionType.EXPENSE,
    },
    notes: 'Market',
    totalValue: 100,
    repeats: RepeatInterval.NONE,
    date: '2026/11/10',
    ...overrides,
  };
}
function range(start: string, end: string): AnalyticsRange {
  return { startDate: parseApiDate(start), endDate: parseApiDate(end) };
}
function installment(
  dueDate: string,
  paidEarly = false
): Installment & { paidEarly: boolean } {
  return {
    id: dueDate,
    installmentNumber: 1,
    totalInstallments: 3,
    amount: 100,
    dueDate,
    paidEarly,
  };
}

describe('analytics periods', (): void => {
  it.each<[PeriodKind, string, string, number]>([
    ['week', '2026/11/09', '2026/11/15', 7],
    ['month', '2026/11/01', '2026/11/30', 30],
    ['year', '2026/01/01', '2026/12/31', 365],
    ['custom', '2026/10/28', '2026/11/03', 7],
  ])(
    'resolves %s to inclusive calendar days',
    (kind, start, end, days): void => {
      const selected = periodRange(
        kind,
        today,
        range('2026/10/28', '2026/11/03')
      );
      expect(format(selected.startDate, 'yyyy/MM/dd')).toBe(start);
      expect(format(selected.endDate, 'yyyy/MM/dd')).toBe(end);
      expect(rangeDays(selected)).toBe(days);
      const previous = previousRange(selected);
      expect(rangeDays(previous)).toBe(days);
      expect(previous.endDate.getTime()).toBeLessThan(
        selected.startDate.getTime()
      );
    }
  );
  it('supports leap years, same-day ranges, invalid ranges and stepping', (): void => {
    expect(rangeDays(periodRange('year', parseApiDate('2024/01/01')))).toBe(
      366
    );
    expect(rangeDays(range('2026/11/14', '2026/11/14'))).toBe(1);
    expect(validRange(range('2026/11/15', '2026/11/14'))).toBe(false);
    expect(validRange({ startDate: new Date(NaN), endDate: today })).toBe(
      false
    );
    expect(format(stepPeriod('week', today, -1), 'yyyy/MM/dd')).toBe(
      '2026/11/07'
    );
    expect(format(stepPeriod('month', today, 1), 'yyyy/MM/dd')).toBe(
      '2026/12/14'
    );
    expect(format(stepPeriod('year', today, 1), 'yyyy/MM/dd')).toBe(
      '2027/11/14'
    );
  });
  it('ignores corrupt persisted settings', (): void => {
    expect(restoreSelection('{')).toBeUndefined();
    expect(
      restoreSelection(
        JSON.stringify({
          kind: 'month',
          anchor: '2026-99-99',
          start: '2026-11-01',
          end: '2026-11-30',
        })
      )
    ).toBeUndefined();
    expect(restoreSelection('{"kind":"quarter"}')).toBeUndefined();
    expect(
      restoreSelection(
        JSON.stringify({
          kind: 'month',
          anchor: '2026-11-14',
          start: '2026-11-01',
          end: '2026-11-30',
        })
      )?.kind
    ).toBe('month');
  });
  it('fetches enough history for comparisons and six future months', (): void => {
    const query = queryRange(periodRange('month', today), today);
    expect(format(query.startDate, 'yyyy/MM/dd')).toBe('2026/08/01');
    expect(format(query.endDate, 'yyyy/MM/dd')).toBe('2027/05/31');
    const historical = queryRange(
      periodRange('year', parseApiDate('2024/01/01')),
      today
    );
    expect(historical.startDate.getTime()).toBe(
      previousRange(
        periodRange('year', parseApiDate('2024/01/01'))
      ).startDate.getTime()
    );
  });
});

describe('date-accurate projections', (): void => {
  it('places daily, weekly, monthly and yearly repeats on occurrence dates', (): void => {
    const selected = range('2026/11/01', '2026/11/30');
    expect(
      projectOccurrences(
        [transaction({ repeats: RepeatInterval.DAILY, date: '2026/10/31' })],
        selected
      )
    ).toHaveLength(30);
    expect(
      projectOccurrences(
        [transaction({ repeats: RepeatInterval.WEEKLY, date: '2026/10/31' })],
        selected
      ).map((entry): number => entry.date.getDate())
    ).toEqual([7, 14, 21, 28]);
    expect(
      projectOccurrences(
        [transaction({ repeats: RepeatInterval.MONTHLY, date: '2026/01/31' })],
        selected
      ).map((entry): number => entry.date.getDate())
    ).toEqual([30]);
    expect(
      projectOccurrences(
        [transaction({ repeats: RepeatInterval.YEARLY, date: '2024/02/29' })],
        periodRange('year', parseApiDate('2025/01/01'))
      ).map((entry): string => format(entry.date, 'yyyy/MM/dd'))
    ).toEqual(['2025/02/28']);
    expect(
      projectOccurrences(
        [transaction({ repeats: RepeatInterval.MONTHLY, date: '2026/12/01' })],
        selected
      )
    ).toEqual([]);
    expect(
      projectOccurrences(
        [transaction({ repeats: RepeatInterval.MONTHLY, date: '2026/10/20' })],
        range('2026/11/01', '2026/11/14')
      )
    ).toEqual([]);
  });
  it('counts early payments on the updated due date, once, instead of the purchase total', (): void => {
    const purchase = transaction({
      totalValue: 300,
      installmentNumbers: 3,
      date: '2026/09/01',
    });
    purchase.installments = [
      installment('2026/11/02', true),
      installment('2026/11/20'),
      installment('2026/12/20'),
    ];
    const occurrences = projectOccurrences(
      [purchase],
      range('2026/11/01', '2027/05/31')
    );
    expect(
      keyFigures([], occurrences, periodRange('month', today), today).expenses
    ).toBe(200);
    const budgets = budgetPanels([], occurrences, today);
    expect(budgets.current.spent).toBe(100);
    expect(budgets.current.committed).toBe(100);
    expect(budgets.next.committed).toBe(100);
    expect(installmentForecast(occurrences, today).series[0]?.data).toEqual([
      100, 0, 0, 0, 0, 0,
    ]);
  });
});

describe('key figures and comparison', (): void => {
  it('uses elapsed inclusive days for current periods and full days otherwise', (): void => {
    const month = periodRange('month', today);
    const expenses = projectOccurrences(
      [transaction({ totalValue: 280 })],
      month
    );
    const incomes = projectOccurrences(
      [transaction({ totalValue: 1000 })],
      month
    );
    expect(keyFigures(incomes, expenses, month, today)).toEqual({
      income: 1000,
      expenses: 280,
      net: 720,
      savingsRate: 72,
      dailyAverage: 20,
    });
    expect(averageDays(month, parseApiDate('2026/12/01'))).toBe(30);
    expect(averageDays(month, parseApiDate('2026/10/01'))).toBe(30);
    expect(averageDays(periodRange('week', today), today)).toBe(6);
    expect(averageDays(range('2026/11/14', '2026/11/14'), today)).toBe(1);
    expect(averageDays(periodRange('year', today), today)).toBe(318);
    expect(keyFigures([], expenses, month, today).savingsRate).toBe(0);
  });
  it('compares against the immediately preceding equal-length period', (): void => {
    const selected = periodRange('month', today);
    const previous = previousRange(selected);
    expect(format(previous.startDate, 'yyyy/MM/dd')).toBe('2026/10/02');
    expect(format(previous.endDate, 'yyyy/MM/dd')).toBe('2026/10/31');
    const expenses = projectOccurrences(
      [
        transaction({ totalValue: 200 }),
        transaction({ date: '2026/10/10', totalValue: 100 }),
        transaction({ date: '2026/10/01', totalValue: 500 }),
      ],
      range('2026/10/01', '2026/11/30')
    );
    expect(
      figureChange(
        keyFigures([], expenses, selected, today).expenses,
        keyFigures([], expenses, previous, today).expenses
      )
    ).toBe(100);
    expect(figureChange(0, 0)).toBe(0);
    expect(figureChange(100, 0)).toBeNull();
    expect(figureChange(-50, -100)).toBe(50);
  });
});

describe('calendar-month budgets', (): void => {
  const query = range('2026/08/01', '2027/05/31');
  it('reserves future commitments, includes due-today spending and excludes future plain expenses', (): void => {
    const incomes = projectOccurrences(
      [
        transaction({
          totalValue: 3000,
          repeats: RepeatInterval.MONTHLY,
          date: '2026/01/01',
        }),
      ],
      query
    );
    const expenses = projectOccurrences(
      [
        transaction({ totalValue: 400, date: '2026/11/14' }),
        transaction({
          totalValue: 600,
          date: '2026/01/20',
          repeats: RepeatInterval.MONTHLY,
        }),
        transaction({ totalValue: 900, date: '2026/11/25' }),
      ],
      query
    );
    const { current, next } = budgetPanels(incomes, expenses, today);
    expect(current).toMatchObject({
      income: 3000,
      spent: 400,
      committed: 600,
      left: 2000,
      days: 16,
      daily: 125,
    });
    expect(current.spentShare).toBeCloseTo((400 / 3000) * 100);
    expect(next).toMatchObject({
      income: 3000,
      estimated: false,
      committed: 600,
      left: 2400,
      days: 31,
      daily: 2400 / 31,
    });
  });
  it('estimates next month from the recent months that had income', (): void => {
    const incomes = projectOccurrences(
      [
        transaction({ date: '2026/08/02', totalValue: 3000 }),
        transaction({ date: '2026/10/02', totalValue: 6000 }),
        transaction({ date: '2026/11/02', totalValue: 90000 }),
        transaction({ date: '2026/12/02', totalValue: 50000 }),
      ],
      query
    );
    // August 3000 and October 6000 count; September had no income and is skipped.
    expect(budgetPanels(incomes, [], today).next).toMatchObject({
      income: 4500,
      estimated: true,
      left: 4500,
    });
  });
  it('does not replace an existing zero-valued scheduled income with a historical estimate', (): void => {
    const incomes = projectOccurrences(
      [
        transaction({ date: '2026/08/02', totalValue: 9000 }),
        transaction({
          date: '2026/12/02',
          totalValue: 0,
          repeats: RepeatInterval.MONTHLY,
        }),
      ],
      query
    );
    expect(budgetPanels(incomes, [], today).next).toMatchObject({
      income: 0,
      estimated: false,
    });
  });
  it('prefers next-month income installments over fallback and never divides by zero', (): void => {
    const purchase = transaction({ totalValue: 900 });
    purchase.installments = [installment('2026/12/10')];
    const income = projectOccurrences([purchase], query);
    expect(budgetPanels(income, [], today).next).toMatchObject({
      income: 100,
      estimated: false,
    });
    const expenses = projectOccurrences(
      [transaction({ totalValue: 100 })],
      query
    );
    expect(
      budgetPanels([], expenses, parseApiDate('2026/11/30')).current
    ).toMatchObject({ left: -100, days: 0, daily: 0 });
    expect(budgetPanels([], [], today).next).toMatchObject({
      income: 0,
      daily: 0,
      estimated: true,
    });
  });
});

describe('chart and savings summaries', (): void => {
  it('buckets without losing partial endpoints and ends at the period totals', (): void => {
    const selected = range('2026/10/28', '2026/12/03');
    const expenses = projectOccurrences(
      [transaction({ totalValue: 370, date: '2026/12/03' })],
      selected
    );
    const weekly = chartBuckets([], expenses, selected);
    expect(weekly).toHaveLength(37);
    const longer = range('2026/10/28', '2027/01/03');
    expect(chartBuckets([], expenses, longer)).toHaveLength(10);
    const annual = chartBuckets([], expenses, periodRange('year', today));
    expect(annual).toHaveLength(12);
    expect(annual.at(-1)?.cumulativeExpenses).toBe(370);
    expect(annual.at(-1)?.daily).toBeCloseTo(370 / 31);
    expect(dailyAllowance(3000, periodRange('month', today))).toBe(100);
  });
  it('ranks all category shares and combines trimmed merchant notes', (): void => {
    const selected = periodRange('month', today);
    const expenses = projectOccurrences(
      [
        transaction({ notes: ' Market ' }),
        transaction({ notes: 'Market', totalValue: 200 }),
        transaction({ notes: null, totalValue: 100 }),
      ],
      selected
    );
    expect(rankExpenses(expenses, selected, 'merchant', 'Unknown')).toEqual([
      { label: 'Market', amount: 300, share: 75 },
      { label: 'Unknown', amount: 100, share: 25 },
    ]);
    expect(rankExpenses(expenses, selected, 'category', 'Unknown')).toEqual([
      { label: 'Food', amount: 400, share: 100 },
    ]);
  });
  it('builds a consistent overview using the same projections across sections', (): void => {
    const selected = periodRange('month', today);
    const overview = analyticsOverview(
      [
        transaction({
          totalValue: 3000,
          date: '2026/01/01',
          repeats: RepeatInterval.MONTHLY,
        }),
      ],
      [transaction({ totalValue: 100 })],
      selected,
      today,
      { unknownMerchant: 'Unknown', unknownCategory: 'Unknown' }
    );
    expect(overview.figures.expenses).toBe(overview.categories[0]?.amount);
    expect(overview.figures.expenses).toBe(
      overview.buckets.at(-1)?.cumulativeExpenses
    );
    expect(overview.allowance).toBe(100);
    expect(overview.hasActivity).toBe(true);
  });
  it('keeps every savings location and sums balances', (): void => {
    const summary = savingsSummary([
      { id: 'cash', name: 'Cash', amount: 50, location: SavingLocation.CASH },
      {
        id: 'cash2',
        name: 'Wallet',
        amount: 20,
        location: SavingLocation.CASH,
      },
    ]);
    expect(summary.total).toBe(70);
    expect(summary.locations).toHaveLength(5);
    expect(
      summary.locations.find(
        (location): boolean => location.location === SavingLocation.CASH
      )?.amount
    ).toBe(70);
  });
});

describe('localized date labels', (): void => {
  it('formats chart bucket labels with date-fns locale in English and Portuguese', (): void => {
    const selected = range('2026/05/10', '2026/05/12');
    const englishBuckets = chartBuckets([], [], selected, enUS);
    const portugueseBuckets = chartBuckets([], [], selected, ptBR);

    expect(englishBuckets.map((bucket): string => bucket.label)).toEqual([
      '10 May',
      '11 May',
      '12 May',
    ]);
    expect(portugueseBuckets.map((bucket): string => bucket.label)).toEqual([
      '10 mai',
      '11 mai',
      '12 mai',
    ]);

    const annual = periodRange('year', today);
    const englishAnnual = chartBuckets([], [], annual, enUS);
    const portugueseAnnual = chartBuckets([], [], annual, ptBR);

    expect(englishAnnual[4]?.label).toBe('May 2026');
    expect(portugueseAnnual[4]?.label).toBe('mai 2026');
  });

  it('formats installment forecast month labels with date-fns locale in English and Portuguese', (): void => {
    const englishForecast = installmentForecast([], today, enUS);
    const portugueseForecast = installmentForecast([], today, ptBR);

    expect(englishForecast.labels).toEqual([
      'Dec 2026',
      'Jan 2027',
      'Feb 2027',
      'Mar 2027',
      'Apr 2027',
      'May 2027',
    ]);
    expect(portugueseForecast.labels).toEqual([
      'dez 2026',
      'jan 2027',
      'fev 2027',
      'mar 2027',
      'abr 2027',
      'mai 2027',
    ]);
  });
});

describe('compact currency axis labels', (): void => {
  it.each<[number | null, string]>([
    [null, ''],
    [0, 'R$ 0'],
    [4000, 'R$ 4 mil'],
    [-4000, '-R$ 4 mil'],
    [1500000, 'R$ 1,5 mi'],
  ])('formats %s for the axis in pt-BR', (value, expected): void => {
    expect(formatCompactBRL(value, 'pt-BR').replace(/\u00a0/g, ' ')).toBe(
      expected
    );
  });

  it.each<[number | null, string]>([
    [null, ''],
    [0, 'R$0'],
    [4000, 'R$4K'],
    [-4000, '-R$4K'],
    [1500000, 'R$1.5M'],
  ])('formats %s for the axis in en-US', (value, expected): void => {
    expect(formatCompactBRL(value, 'en-US').replace(/\u00a0/g, ' ')).toBe(
      expected
    );
  });

  it('preserves full currency precision for tooltips in both locales', (): void => {
    expect(formatBRL(4000.25, 'pt-BR').replace(/\u00a0/g, ' ')).toBe(
      'R$ 4.000,25'
    );
    expect(formatBRL(4000.25, 'en-US').replace(/\u00a0/g, ' ')).toBe(
      'R$4,000.25'
    );
  });
});

describe('formatPercent', (): void => {
  it('uses the decimal separator of the language', (): void => {
    expect(formatPercent(64.1, 'en')).toBe('64.1%');
    expect(formatPercent(64.1, 'pt')).toBe('64,1%');
    expect(formatPercent(0, 'pt')).toBe('0,0%');
  });

  it('signs changes when asked', (): void => {
    expect(formatPercent(194.9, 'en', true)).toBe('+194.9%');
    expect(formatPercent(-23.1, 'pt', true)).toBe('-23,1%');
    expect(formatPercent(0, 'pt', true)).toBe('0,0%');
  });
});
