'use client';

import {
  Panel,
  Button,
  Field,
  MonthSwitcher,
  DateField,
  parseFieldDate,
  formatFieldDate,
  Page,
  SegmentedControl,
} from '@/components/ui';
import {
  AnalyticsCard,
  BudgetPanel,
  EmptyState,
  RankedList,
} from '@/components/Analytics/AnalyticsPanels';
import { paymentRanking } from '@/utils/payment.util';
import { TransactionType } from '@/enums';
import { useSavings, useTransactions } from '@/hooks';
import { useI18n } from '@/i18n/useI18n';
import {
  type Figures,
  type PeriodKind,
  type PeriodSelection,
  type AnalyticsRange,
  type AnalyticsOverview,
  analyticsOverview,
  figureChange,
  formatBRL,
  formatCompactBRL,
  formatPercent,
  periodRange,
  queryRange,
  restoreSelection,
  savingsSummary,
  stepPeriod,
  validRange,
} from '@/utils/analytics.util';
import { parseApiDate } from '@/utils/globalFormats.util';
import { stillOwed, type StillOwed } from '@/utils/stillOwed.util';
import { getFetcher } from '@/libs/fetchers.lib';
import type { Financing } from '@budget-manager/api-client';
import useSWR from 'swr';
import {
  BarChart,
  ChartsReferenceLine,
  LineChart,
  PieChart,
} from '@mui/x-charts';
import { format } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { useMemo, useState, useSyncExternalStore, type JSX } from 'react';

const storageKey = 'budget-manager.analytics.period';
const storageEvent = 'analytics-period-change';
const colors = [
  'var(--ctp-blue)',
  'var(--ctp-peach)',
  'var(--ctp-mauve)',
  'var(--ctp-teal)',
  'var(--ctp-yellow)',
  'var(--ctp-green)',
  'var(--ctp-red)',
];
const chartStyle = {
  '& .MuiChartsAxis-tickLabel, & .MuiChartsLegend-label, & .MuiChartsAxis-label, & .MuiChartsReferenceLine-label':
    { fill: 'var(--ctp-subtext1)', color: 'var(--ctp-text)' },
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
    stroke: 'var(--ctp-surface2)',
  },
  '& .MuiChartsGrid-line': { stroke: 'var(--ctp-surface1)' },
};

function readStorage(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function subscribeStorage(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  window.addEventListener(storageEvent, listener);
  return (): void => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(storageEvent, listener);
  };
}

function serverStorage(): null {
  return null;
}

function Skeleton({ label }: { label: string }): JSX.Element {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid animate-pulse gap-4 md:grid-cols-2"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: 6 }, (_unusedValue, index): JSX.Element => (
        <Panel key={index} className="h-52" />
      ))}
    </div>
  );
}

function changeLabel(
  current: number,
  previous: number,
  comparisonText: string,
  noBaselineText: string,
  language: string
): string {
  const change = figureChange(current, previous);
  if (change === null) {
    return noBaselineText;
  }
  return `${formatPercent(change, language, true)} ${comparisonText}`;
}

export default function AnalyticsPage(): JSX.Element {
  const { language, t } = useI18n();
  const messages = t.analytics;
  const dateLocale = language === 'pt' ? ptBR : enUS;
  const numberLocale = language === 'pt' ? 'pt-BR' : 'en-US';

  const formatMoney = (value: number | null): string =>
    formatBRL(value, numberLocale);
  const formatCompact = (value: number | null): string =>
    formatCompactBRL(value, numberLocale);

  const [today] = useState((): Date => new Date());
  const stored = useSyncExternalStore(
    subscribeStorage,
    readStorage,
    serverStorage
  );
  const [localSelection, setLocalSelection] = useState<PeriodSelection | null>(
    null
  );
  const initialDate = format(today, 'yyyy-MM-dd');
  const selection = localSelection ??
    restoreSelection(stored) ?? {
      kind: 'month',
      anchor: initialDate,
      start: initialDate,
      end: initialDate,
    };

  function updateSelection(update: Partial<PeriodSelection>): void {
    const next = { ...selection, ...update };
    setLocalSelection(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event(storageEvent));
    } catch {
      /* In-memory selection still works when storage is unavailable. */
    }
  }

  const range = useMemo(
    (): AnalyticsRange =>
      periodRange(selection.kind, parseApiDate(selection.anchor), {
        startDate: parseApiDate(selection.start),
        endDate: parseApiDate(selection.end),
      }),
    [selection.kind, selection.anchor, selection.start, selection.end]
  );
  const invalid = !validRange(range);
  const safeRange = useMemo(
    (): AnalyticsRange => (invalid ? periodRange('month', today) : range),
    [invalid, range, today]
  );
  const query = useMemo(
    (): AnalyticsRange => queryRange(safeRange, today),
    [safeRange, today]
  );
  const incomeRequest = useTransactions(TransactionType.INCOME, query, {
    loadAll: true,
    pageSize: 1000,
  });
  const expenseRequest = useTransactions(TransactionType.EXPENSE, query, {
    loadAll: true,
    pageSize: 1000,
  });
  const savingsRequest = useSavings();
  const financingsRequest = useSWR('/financings', getFetcher<Financing[]>);
  const owed: StillOwed = useMemo(
    (): StillOwed =>
      stillOwed(expenseRequest.data ?? [], financingsRequest.data ?? [], today),
    [expenseRequest.data, financingsRequest.data, today]
  );
  const data = useMemo(
    (): AnalyticsOverview =>
      analyticsOverview(
        incomeRequest.data ?? [],
        expenseRequest.data ?? [],
        safeRange,
        today,
        messages,
        dateLocale
      ),
    [
      incomeRequest.data,
      expenseRequest.data,
      safeRange,
      today,
      messages,
      dateLocale,
    ]
  );
  const savings = savingsSummary(savingsRequest.data ?? []);
  const loading =
    incomeRequest.isLoading ||
    expenseRequest.isLoading ||
    incomeRequest.isLoadingMore ||
    expenseRequest.isLoadingMore ||
    incomeRequest.hasMore ||
    expenseRequest.hasMore;
  const error = incomeRequest.error || expenseRequest.error;
  const xAxis = [
    {
      data: data.buckets.map((bucket): string => bucket.label),
      scaleType: 'band' as const,
      tickLabelInterval: 'auto' as const,
      tickLabelMinGap: 16,
    },
  ];
  const moneyAxis = [
    {
      valueFormatter: (value: number | null): string => formatCompact(value),
      width: 85,
    },
  ];

  return (
    <Page>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {messages.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--ctp-subtext1)]">
          {messages.subtitle}
        </p>
      </header>
      <Panel
        as="section"
        aria-label={messages.title}
        className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <SegmentedControl
          label={messages.title}
          value={selection.kind}
          onChange={(kind): void => updateSelection({ kind })}
          options={(Object.keys(messages.periods) as PeriodKind[]).map(
            (kind): { value: PeriodKind; label: string } => ({
              value: kind,
              label: messages.periods[kind],
            })
          )}
        />
        {selection.kind === 'custom' ? (
          <div className="flex flex-wrap gap-3">
            {(['start', 'end'] as const).map((field): JSX.Element => (
              <Field
                label={field === 'start' ? messages.from : messages.to}
                key={field}
              >
                <DateField
                  value={parseFieldDate(selection[field])}
                  onChange={(pickedDate): void =>
                    updateSelection({ [field]: formatFieldDate(pickedDate) })
                  }
                />
              </Field>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-0 sm:gap-2">
            {selection.kind === 'month' && (
              <MonthSwitcher
                value={parseApiDate(selection.anchor)}
                onChange={(date): void =>
                  updateSelection({ anchor: format(date, 'yyyy-MM-dd') })
                }
              />
            )}
            {selection.kind !== 'month' && (
              <>
                <Button
                  variant="ghost"
                  aria-label={messages.previous}
                  onClick={(): void =>
                    updateSelection({
                      anchor: format(
                        stepPeriod(
                          selection.kind,
                          parseApiDate(selection.anchor),
                          -1
                        ),
                        'yyyy-MM-dd'
                      ),
                    })
                  }
                >
                  ←
                </Button>
                <span className="min-w-0 text-center text-xs font-medium whitespace-nowrap sm:text-sm">
                  {format(range.startDate, 'dd MMM yyyy', {
                    locale: dateLocale,
                  })}{' '}
                  –{' '}
                  {format(range.endDate, 'dd MMM yyyy', { locale: dateLocale })}
                </span>
                <Button
                  variant="ghost"
                  aria-label={messages.next}
                  onClick={(): void =>
                    updateSelection({
                      anchor: format(
                        stepPeriod(
                          selection.kind,
                          parseApiDate(selection.anchor),
                          1
                        ),
                        'yyyy-MM-dd'
                      ),
                    })
                  }
                >
                  →
                </Button>
                <Button
                  variant="primary"
                  onClick={(): void => updateSelection({ anchor: initialDate })}
                >
                  {messages.today}
                </Button>
              </>
            )}
          </div>
        )}
      </Panel>
      {invalid && (
        <p
          role="alert"
          className="rounded-xl border border-[var(--ctp-red)] p-4"
        >
          {messages.invalid}
        </p>
      )}
      {!invalid && error && <p role="alert">{messages.error}</p>}
      {!invalid && !error && loading && <Skeleton label={messages.loading} />}
      {!invalid && !error && !loading && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {(Object.keys(messages.figures) as (keyof Figures)[]).map(
              (key): JSX.Element => (
                <Panel
                  as="div"
                  key={key}
                  className="min-w-0 last:col-span-2 sm:p-5 sm:last:col-span-1"
                >
                  <p className="text-sm text-[var(--ctp-subtext1)]">
                    {messages.figures[key]}
                  </p>
                  <p className="my-2 text-lg font-semibold tracking-tight break-words sm:text-2xl">
                    {key === 'savingsRate'
                      ? formatPercent(data.figures[key], language)
                      : formatMoney(data.figures[key])}
                  </p>
                  <p className="text-xs text-[var(--ctp-subtext1)]">
                    {changeLabel(
                      data.figures[key],
                      data.previous[key],
                      messages.comparison,
                      messages.noBaseline,
                      language
                    )}
                  </p>
                </Panel>
              )
            )}
          </section>
          <p className="-mt-3 text-xs text-[var(--ctp-subtext1)]">
            {messages.periodNote}
          </p>
          <section>
            <h2 className="text-xl font-semibold">{messages.budget}</h2>
            <p className="mt-1 mb-4 text-sm text-[var(--ctp-subtext1)]">
              {messages.budgetNote}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <BudgetPanel budget={data.budgets.current} />
              <BudgetPanel budget={data.budgets.next} next />
            </div>
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            <AnalyticsCard
              title={messages.dailyChart}
              note={messages.dailyNote}
            >
              {data.hasActivity ? (
                <BarChart
                  aria-label={messages.dailyChart}
                  sx={chartStyle}
                  xAxis={xAxis}
                  yAxis={moneyAxis}
                  series={[
                    {
                      data: data.buckets.map((bucket): number => bucket.daily),
                      label: messages.dailySpending,
                      color: colors[0],
                      valueFormatter: (value: number | null): string =>
                        formatMoney(value),
                    },
                  ]}
                  height={300}
                  grid={{ horizontal: true }}
                >
                  {data.allowance > 0 && (
                    <ChartsReferenceLine
                      y={data.allowance}
                      label={`${messages.allowance}: ${formatMoney(data.allowance)}`}
                      labelAlign="end"
                      spacing={{ x: 4, y: 10 }}
                      lineStyle={{
                        stroke: 'var(--ctp-text)',
                        strokeDasharray: '5 5',
                      }}
                    />
                  )}
                </BarChart>
              ) : (
                <EmptyState />
              )}
            </AnalyticsCard>
            <AnalyticsCard title={messages.flowChart}>
              {data.hasActivity ? (
                <BarChart
                  aria-label={messages.flowChart}
                  sx={chartStyle}
                  xAxis={xAxis}
                  yAxis={moneyAxis}
                  series={[
                    {
                      data: data.buckets.map((bucket): number => bucket.income),
                      label: messages.figures.income,
                      color: 'var(--ctp-green)',
                      valueFormatter: (value: number | null): string =>
                        formatMoney(value),
                    },
                    {
                      data: data.buckets.map(
                        (bucket): number => bucket.expenses
                      ),
                      label: messages.figures.expenses,
                      color: 'var(--ctp-peach)',
                      valueFormatter: (value: number | null): string =>
                        formatMoney(value),
                    },
                  ]}
                  height={300}
                  grid={{ horizontal: true }}
                />
              ) : (
                <EmptyState />
              )}
            </AnalyticsCard>
            <AnalyticsCard title={messages.cumulativeChart}>
              {data.hasActivity ? (
                <LineChart
                  aria-label={messages.cumulativeChart}
                  sx={chartStyle}
                  xAxis={[{ ...xAxis[0], scaleType: 'point' }]}
                  yAxis={moneyAxis}
                  series={[
                    {
                      data: data.buckets.map(
                        (bucket): number => bucket.cumulativeIncome
                      ),
                      label: messages.figures.income,
                      color: 'var(--ctp-green)',
                      valueFormatter: (value: number | null): string =>
                        formatMoney(value),
                      showMark: false,
                    },
                    {
                      data: data.buckets.map(
                        (bucket): number => bucket.cumulativeExpenses
                      ),
                      label: messages.figures.expenses,
                      color: 'var(--ctp-peach)',
                      valueFormatter: (value: number | null): string =>
                        formatMoney(value),
                      showMark: false,
                    },
                  ]}
                  height={300}
                  grid={{ horizontal: true }}
                />
              ) : (
                <EmptyState />
              )}
            </AnalyticsCard>
            <AnalyticsCard title={messages.categories}>
              {data.categories.length > 0 ? (
                <>
                  <PieChart
                    aria-label={messages.categories}
                    sx={chartStyle}
                    colors={colors}
                    series={[
                      {
                        data: data.categories.map(
                          (
                            category
                          ): { id: string; label: string; value: number } => ({
                            id: category.label,
                            label: category.label,
                            value: category.amount,
                          })
                        ),
                        innerRadius: '65%',
                        valueFormatter: (item: { value: number }): string =>
                          formatMoney(item.value),
                      },
                    ]}
                    hideLegend
                    height={220}
                  />
                  <RankedList
                    items={data.categories}
                    scrollLabel={messages.categories}
                  />
                </>
              ) : (
                <EmptyState />
              )}
            </AnalyticsCard>
            <AnalyticsCard title={t.payments.howPaid}>
              <h3 className="mb-3 text-sm text-[var(--ctp-subtext1)]">
                {t.payments.method}
              </h3>
              <RankedList
                items={paymentRanking(
                  expenseRequest.data ?? [],
                  safeRange,
                  t.payments.methods,
                  t.payments.notSet
                )}
              />
              <h3 className="my-3 text-sm text-[var(--ctp-subtext1)]">
                {t.cards.title}
              </h3>
              <RankedList
                items={paymentRanking(
                  expenseRequest.data ?? [],
                  safeRange,
                  t.payments.methods,
                  t.payments.notSet,
                  { card: t.cards.card, account: t.payments.account }
                )}
              />
            </AnalyticsCard>
            <AnalyticsCard title={messages.merchants}>
              <RankedList items={data.merchants} />
            </AnalyticsCard>
            <AnalyticsCard
              title={messages.installments}
              note={messages.installmentNote}
            >
              {data.forecast.series.length > 0 ? (
                <BarChart
                  aria-label={messages.installments}
                  sx={chartStyle}
                  colors={colors}
                  xAxis={[
                    {
                      data: data.forecast.labels,
                      scaleType: 'band',
                      tickLabelInterval: 'auto',
                      tickLabelMinGap: 16,
                    },
                  ]}
                  yAxis={moneyAxis}
                  series={data.forecast.series.map(
                    (
                      series
                    ): {
                      label: string;
                      data: number[];
                      stack: string;
                      valueFormatter: (value: number | null) => string;
                    } => ({
                      ...series,
                      stack: 'installments',
                      valueFormatter: (value: number | null): string =>
                        formatMoney(value),
                    })
                  )}
                  height={300}
                  grid={{ horizontal: true }}
                />
              ) : (
                <EmptyState />
              )}
            </AnalyticsCard>
            <AnalyticsCard title={messages.owed} note={messages.owedNote}>
              {owed.total > 0 ? (
                <div className="flex flex-col gap-5">
                  <p className="text-3xl font-semibold">
                    {formatMoney(owed.total)}
                  </p>
                  {owed.cards.length > 0 && (
                    <section className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-[var(--ctp-subtext1)]">
                        {messages.owedCards}
                      </h3>
                      <ul className="flex flex-col gap-2">
                        {owed.cards.map((card): JSX.Element => (
                          <li
                            key={card.card}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span className="min-w-0">
                              {card.card}
                              <span className="ml-2 text-xs text-[var(--ctp-subtext1)]">
                                {messages.owedInstallments(card.installments)}
                              </span>
                            </span>
                            <span className="font-medium tabular-nums">
                              {formatMoney(card.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {owed.financings.length > 0 && (
                    <section className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-[var(--ctp-subtext1)]">
                        {messages.owedFinancings}
                      </h3>
                      <ul className="flex flex-col gap-3">
                        {owed.financings.map((financing): JSX.Element => (
                          <li
                            key={financing.id}
                            className="flex flex-col gap-1"
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0">
                                {financing.name}
                                <span className="ml-2 text-xs text-[var(--ctp-subtext1)]">
                                  {messages.owedInstallments(
                                    financing.installments
                                  )}
                                </span>
                              </span>
                              <span className="font-medium tabular-nums">
                                {formatMoney(financing.outstanding)}
                              </span>
                            </span>
                            <span className="text-xs text-[var(--ctp-subtext1)]">
                              {messages.owedWithInterest(
                                formatMoney(financing.remainingPayments)
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[var(--ctp-subtext1)]">
                  {messages.owedNothing}
                </p>
              )}
            </AnalyticsCard>
          </div>
        </>
      )}
      <AnalyticsCard title={messages.savings}>
        {savingsRequest.error && <p role="alert">{messages.error}</p>}
        {savingsRequest.isLoading && <Skeleton label={messages.loading} />}
        {!savingsRequest.error && !savingsRequest.isLoading && (
          <>
            <p className="text-sm text-[var(--ctp-subtext1)]">
              {messages.totalSaved}
            </p>
            <p className="mt-1 mb-6 text-3xl font-semibold">
              {formatMoney(savings.total)}
            </p>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {savings.locations.map((location): JSX.Element => (
                <Panel key={location.location}>
                  <dt className="text-xs text-[var(--ctp-subtext1)]">
                    {messages.locations[location.location]}
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {formatMoney(location.amount)}
                  </dd>
                </Panel>
              ))}
            </dl>
          </>
        )}
      </AnalyticsCard>
    </Page>
  );
}
