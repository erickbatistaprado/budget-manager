'use client';
import { Panel, Button } from '@/components/ui';
import type { JSX } from 'react';
import type { MonthOverview, MovementDraft } from '@budget-manager/api-client';
import { useI18n } from '@/i18n/useI18n';
import { formatBRL } from '@/utils/analytics.util';
import { monthKey } from '@/utils/monthlyTransaction.util';

import { investmentDraft, type Entry } from './model';
export default function MonthSummary({
  overview,
  incomes,
  month,
  salaryDay,
  mainAccountId,
  onInvest,
  outflows = {},
  ready = true,
}: {
  outflows?: Record<string, number>;
  ready?: boolean;
  overview: MonthOverview;
  incomes: Entry[];
  month: Date;
  salaryDay?: number | null;
  mainAccountId?: string | null;
  onInvest: (draft: Partial<MovementDraft>) => void;
}): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.dashboard;
  const today = new Date();
  const payday = Math.min(
    salaryDay ?? 1,
    new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  );
  let salaryDate = new Date(today.getFullYear(), today.getMonth(), payday);
  if (salaryDate.getDate() < today.getDate()) {
    const nextLast = new Date(
      today.getFullYear(),
      today.getMonth() + 2,
      0
    ).getDate();
    salaryDate = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      Math.min(salaryDay ?? 1, nextLast)
    );
  }
  const days = Math.round(
    (Date.UTC(
      salaryDate.getFullYear(),
      salaryDate.getMonth(),
      salaryDate.getDate()
    ) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000
  );
  let surplusColor = 'var(--ctp-text)';
  if (overview.surplus > 0) surplusColor = 'var(--ctp-green)';
  if (overview.surplus < 0) surplusColor = 'var(--ctp-red)';
  const income = Math.max(0, overview.incomes);
  const negative = overview.expenses > income;
  const parts = [
    {
      label: labels.expenses,
      amount: Math.max(0, overview.expenses),
      color: 'var(--ctp-red)',
    },
    {
      label: labels.invested,
      amount: Math.max(0, overview.invested),
      color: 'var(--ctp-mauve)',
    },
    {
      label: negative ? labels.shortfall : labels.kept,
      amount: negative
        ? overview.expenses - income
        : Math.max(0, overview.kept),
      color: negative ? 'var(--ctp-red)' : 'var(--ctp-green)',
    },
  ];
  const percentage = (amount: number): number =>
    income > 0 ? (amount / income) * 100 : 0;
  function barWidth(amount: number, index: number): number {
    if (negative) return index === 0 ? 100 : 0;
    return Math.min(100, percentage(amount));
  }
  const describe = (part: (typeof parts)[number]): string =>
    `${part.label} ${formatBRL(part.amount, language)} · ${Math.round(percentage(part.amount))}%`;
  return (
    <Panel
      className="flex w-full flex-col gap-3"
      aria-labelledby="month-summary"
    >
      <h2 id="month-summary" className="text-xl font-semibold">
        {labels.summary}
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [labels.income, overview.incomes, 'var(--ctp-green)'],
          [labels.expenses, overview.expenses, 'var(--ctp-red)'],
          [labels.surplus, overview.surplus, surplusColor],
        ].map(([label, amount, color]): JSX.Element => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="text-2xl" style={{ color: String(color) }}>
              {formatBRL(Number(amount), language)}
            </dd>
          </div>
        ))}
      </dl>
      {income > 0 ? (
        <div
          className="flex h-2 overflow-hidden rounded bg-[var(--ctp-surface1)]"
          role="img"
          aria-label={parts.map(describe).join('; ')}
        >
          {parts.map((part, index): JSX.Element => (
            <span
              key={part.label}
              style={{
                backgroundColor: part.color,
                width: `${barWidth(part.amount, index)}%`,
              }}
            />
          ))}
        </div>
      ) : (
        <p>{labels.noIncome}</p>
      )}
      <ul className="flex flex-wrap gap-3 text-sm">
        {parts.map((part): JSX.Element => (
          <li key={part.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: part.color }}
            />
            {describe(part)}
          </li>
        ))}
      </ul>
      {negative && (
        <p className="text-sm">
          {labels.accountFlows}:{' '}
          {overview.accounts
            .filter((account): boolean => Boolean(outflows[account.id]))
            .map(
              (account): string =>
                `${account.name} ${formatBRL(outflows[account.id], language)}`
            )
            .join(' · ')}
        </p>
      )}
      {salaryDay && monthKey(month) === monthKey(today) && days >= 0 && (
        <p className="text-sm text-[var(--ctp-subtext0)]">
          {days === 0 ? labels.salaryToday : labels.salaryDays(days)}
        </p>
      )}
      <div>
        {overview.kept > 0 && overview.surplus >= 0 && (
          <Button
            variant="secondary"
            disabled={!ready}
            onClick={(): void =>
              onInvest(
                investmentDraft(
                  overview.kept,
                  incomes,
                  month,
                  new Date(),
                  mainAccountId
                )
              )
            }
          >
            {labels.invest}
          </Button>
        )}
      </div>
    </Panel>
  );
}
