'use client';
import type { JSX } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import type { Goal, GoalPlan } from '@budget-manager/api-client';
import { Panel, ProgressBar } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import { getFetcher } from '@/libs/fetchers.lib';
import { formatBRL } from '@/utils/analytics.util';
import { getLocation } from '@/utils/globalFormats.util';
export default function NextGoal(): JSX.Element {
  const { t, language } = useI18n();
  const { data: goals, error } = useSWR('/goals', getFetcher<Goal[]>);
  const { data: plan, error: planError } = useSWR(
    '/goals/plan',
    getFetcher<GoalPlan>
  );
  const goal = goals
    ?.filter((item): boolean => item.status === 'ACTIVE')
    .sort((left, right): number => left.position - right.position)[0];
  const forecast = plan?.goals.find((item): boolean => item.id === goal?.id);
  const saved = forecast?.saved ?? 0;
  return (
    <Panel title={t.goals.next} className="min-w-0 space-y-3 break-words">
      {(error || planError) && <p role="alert">{t.goals.loadError}</p>}
      {!goals && !error && <p role="status">{t.goals.loading}</p>}
      {goal && (
        <>
          <strong>{goal.name}</strong>
          <p>
            {formatBRL(saved, language)} / {formatBRL(goal.price, language)}
          </p>
          <ProgressBar
            success
            label={goal.name}
            value={(saved / goal.price) * 100}
          />
          <p>
            {t.goals.forecast}:{' '}
            {forecast?.expectedMonth
              ? new Date(
                  `${forecast.expectedMonth}-01T12:00:00`
                ).toLocaleDateString(getLocation(language), {
                  month: 'long',
                  year: 'numeric',
                })
              : t.goals.capped}
          </p>
          <Link href="/goals" className="underline">
            {t.goals.title}
          </Link>
        </>
      )}
      {goals && !goal && (
        <Link href="/goals?new=1" className="underline">
          {t.goals.new}
        </Link>
      )}
    </Panel>
  );
}
