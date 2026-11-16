import { Panel } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  formatPercent,
  formatBRL,
  type Budget,
  type RankedAmount,
} from '@/utils/analytics.util';
import type { JSX, ReactNode } from 'react';

export function AnalyticsCard({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: string;
}): JSX.Element {
  return (
    <Panel as="section" className="min-w-0">
      <h2 className="mb-4 font-semibold text-[var(--ctp-text)]">{title}</h2>
      {note && (
        <p className="mb-4 text-sm text-[var(--ctp-subtext1)]">{note}</p>
      )}
      {children}
    </Panel>
  );
}

export function EmptyState({
  message,
}: { message?: string } = {}): JSX.Element {
  const { t } = useI18n();
  return (
    <p className="flex min-h-32 items-center justify-center text-sm text-[var(--ctp-subtext1)]">
      {message ?? t.analytics.empty}
    </p>
  );
}

/**
 * Amounts ranked with their share. With `scrollLabel`, a long list scrolls inside a fixed height
 * region (keyboard focusable, named by the label) instead of growing the card.
 */
export function RankedList({
  items,
  scrollLabel,
}: {
  items: RankedAmount[];
  scrollLabel?: string;
}): JSX.Element {
  const { language } = useI18n();
  const numberLocale = language === 'pt' ? 'pt-BR' : 'en-US';

  if (!items.length) {
    return <EmptyState />;
  }

  const list: JSX.Element = (
    <ol className="space-y-4">
      {items.map((item, index): JSX.Element => (
        <li key={item.label}>
          <div className="mb-2 flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">
              <span className="mr-2 text-[var(--ctp-subtext1)]">
                {index + 1}.
              </span>
              {item.label}
            </span>
            <span className="shrink-0 text-right font-medium">
              {formatBRL(item.amount, numberLocale)}
              <span className="ml-2 text-xs text-[var(--ctp-subtext1)]">
                {formatPercent(item.share, language)}
              </span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ctp-surface1)]">
            <div
              className="h-full rounded-full bg-[var(--ctp-blue)]"
              style={{ width: `${item.share}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );

  if (!scrollLabel) {
    return list;
  }

  return (
    <div
      role="region"
      aria-label={scrollLabel}
      tabIndex={0}
      className="max-h-80 overflow-y-auto pr-2 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--ctp-blue)] focus-visible:outline-none"
    >
      {list}
    </div>
  );
}

export function BudgetPanel({
  budget,
  next = false,
}: {
  budget: Budget;
  next?: boolean;
}): JSX.Element {
  const { language, t } = useI18n();
  const numberLocale = language === 'pt' ? 'pt-BR' : 'en-US';
  const messages = t.analytics;

  const rows: { label: string; value: number }[] = [
    { label: messages.expected, value: budget.income },
    {
      label: next ? messages.nextCommitted : messages.committed,
      value: budget.committed,
    },
  ];

  if (!next) {
    rows.splice(1, 0, { label: messages.spent, value: budget.spent });
  }

  return (
    <AnalyticsCard title={next ? messages.nextMonth : messages.thisMonth}>
      {budget.estimated && (
        <p className="mb-4 text-xs text-[var(--ctp-subtext1)]">
          {messages.estimate}
        </p>
      )}
      <dl className="space-y-3">
        {rows.map((row): JSX.Element => (
          <div key={row.label} className="flex justify-between gap-2 text-sm">
            <dt className="text-[var(--ctp-subtext1)]">{row.label}</dt>
            <dd className="font-medium">
              {formatBRL(row.value, numberLocale)}
            </dd>
          </div>
        ))}
      </dl>
      {!next && (
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-[var(--ctp-subtext1)]">
            <span>{messages.spentShare}</span>
            <span>{formatPercent(budget.spentShare, language)}</span>
          </div>
          <div
            role="progressbar"
            aria-label={messages.spentShare}
            aria-valuenow={Math.min(100, Math.max(0, budget.spentShare))}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 overflow-hidden rounded-full bg-[var(--ctp-surface1)]"
          >
            <div
              className="h-full bg-[var(--ctp-blue)]"
              style={{
                width: `${Math.min(100, Math.max(0, budget.spentShare))}%`,
              }}
            />
          </div>
        </div>
      )}
      <Panel className="mt-5">
        <p className="text-sm text-[var(--ctp-subtext1)]">
          {next ? messages.free : messages.left}
        </p>
        <p
          className="mt-1 text-3xl font-semibold tracking-tight"
          style={{
            color: budget.left < 0 ? 'var(--ctp-red)' : 'var(--ctp-text)',
          }}
        >
          {formatBRL(budget.left, numberLocale)}
        </p>
        <div className="mt-3 flex justify-between gap-2 text-sm">
          <span>{next ? messages.nextDaily : messages.daily}</span>
          <strong>{formatBRL(budget.daily, numberLocale)}</strong>
        </div>
        {!next && (
          <p className="mt-2 text-xs text-[var(--ctp-subtext1)]">
            {messages.remaining}: {budget.days}
          </p>
        )}
      </Panel>
    </AnalyticsCard>
  );
}
