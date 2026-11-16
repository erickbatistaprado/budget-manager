'use client';
import { useState, type JSX } from 'react';
import useSWR from 'swr';
import type { GoalSavingsTip } from '@budget-manager/api-client';
import { Checkbox, Panel, MonthSwitcher } from '@/components/ui';
import { TransactionType } from '@/enums';
import useCategories from '@/hooks/useCategories.hook';
import { useI18n } from '@/i18n/useI18n';
import { getFetcher, putFetcher } from '@/libs/fetchers.lib';
import { formatBRL } from '@/utils/analytics.util';
import { getLocation } from '@/utils/globalFormats.util';
import { monthKey } from '@/utils/monthlyTransaction.util';
export default function SavingsTips(): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.goals;
  const [month, setMonth] = useState((): Date => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() - 1, 1);
  });
  const {
    data: tips,
    error,
    mutate,
  } = useSWR(
    `/goals/savings-tips?month=${monthKey(month)}`,
    getFetcher<GoalSavingsTip[]>
  );
  const { data: categories, mutate: reloadCategories } = useCategories(
    TransactionType.EXPENSE
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function fixed(id: string, checked: boolean): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      await putFetcher(`/categories/${id}/fixed-cost`, {
        body: JSON.stringify({ fixedCost: checked }),
      });
      await Promise.all([reloadCategories(), mutate()]);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title={labels.tips} className="min-w-0 space-y-3 break-words">
      <MonthSwitcher value={month} onChange={setMonth} />
      <p className="text-sm text-[var(--ctp-subtext0)]">{labels.tipsHelp}</p>
      {(error || failed) && <p role="alert">{labels.error}</p>}
      {!tips && !error && <p role="status">{labels.loading}</p>}
      {tips?.length === 0 && <p>{labels.noTips}</p>}
      <ul className="space-y-3">
        {tips?.map((tip): JSX.Element => (
          <li key={tip.categoryId}>
            <strong>{tip.category}</strong>: {formatBRL(tip.amount, language)}{' '}
            {labels.tipAmount},{' '}
            {tip.percentAbove === null
              ? labels.newBaseline
              : `${Math.round(tip.percentAbove).toLocaleString(getLocation(language))}% ${labels.above}`}
            <p>
              {labels.cut}: {formatBRL(tip.difference, language)}
              {labels.perMonth}
            </p>
            {tip.goalName && tip.monthsGained !== null && (
              <p>{labels.gained(tip.goalName, tip.monthsGained)}</p>
            )}
            {tip.improvedMonth && (tip.monthsGained ?? 0) > 0 && (
              <p>
                {labels.forecast}:{' '}
                {new Date(
                  `${tip.improvedMonth}-01T12:00:00`
                ).toLocaleDateString(getLocation(language), {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
      <details>
        <summary>{labels.settings}</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {categories?.map((category): JSX.Element => (
            <Checkbox
              key={category.id}
              disabled={busy}
              checked={category.fixedCost === true}
              label={`${category.name} · ${labels.fixedCost}`}
              onChange={(event): void => {
                void fixed(category.id, event.currentTarget.checked);
              }}
            />
          ))}
        </div>
      </details>
    </Panel>
  );
}
