'use client';
import { useState, type JSX } from 'react';
import useSWR from 'swr';
import { FiArrowUp, FiArrowDown, FiMenu } from 'react-icons/fi';
import {
  Button,
  IconButton,
  Field,
  NumberInput,
  Panel,
  Badge,
  ProgressBar,
} from '@/components/ui';
import GoalForm from '@/components/Goals/GoalForm';
import PurchaseForm from '@/components/Goals/PurchaseForm';
import SavingsTips from '@/components/Goals/SavingsTips';
import Drawer from '@/components/Home/Drawer';
import AllocationForm from '@/components/Goals/AllocationForm';
import useSavings from '@/hooks/useSavings.hook';
import useAccounts from '@/hooks/useAccounts.hook';
import { useI18n } from '@/i18n/useI18n';
import {
  getFetcher,
  postFetcher,
  putFetcher,
  deleteFetcher,
} from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import { formatBRL } from '@/utils/analytics.util';
import { getLocation } from '@/utils/globalFormats.util';
import type { Goal, GoalPlan } from '@budget-manager/api-client';

type Editor =
  | { kind: 'goal'; goal?: Goal }
  | { kind: 'allocation'; goal: Goal; release: boolean }
  | { kind: 'delete'; goal: Goal }
  | { kind: 'purchase'; goal: Goal };
export default function GoalsPage(): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.goals;
  const {
    data: goals,
    error: goalsError,
    mutate: reloadGoals,
  } = useSWR('/goals', getFetcher<Goal[]>);
  const {
    data: plan,
    error: planError,
    mutate: reloadPlan,
  } = useSWR('/goals/plan', getFetcher<GoalPlan>);
  const { data: savings } = useSavings();
  const { data: accounts } = useAccounts();
  const [editor, setEditor] = useState<Editor | null>((): Editor | null =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('new')
      ? { kind: 'goal' }
      : null
  );
  const [pace, setPace] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const ranked = [...(goals ?? [])]
    .filter((goal): boolean => goal.status === 'ACTIVE')
    .sort((left, right): number => left.position - right.position);
  async function run(
    action: () => Promise<unknown>,
    close = true
  ): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      await action();
      if (close) setEditor(null);
      await Promise.all([reloadGoals(), reloadPlan(), refreshMoneyFlow()]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  function move(id: string, position: number): void {
    void run(
      (): Promise<unknown> =>
        putFetcher(`/goals/${id}/position`, {
          body: JSON.stringify({ position }),
        }),
      false
    );
  }
  function month(value: string): string {
    return new Date(`${value}-01T12:00:00`)
      .toLocaleDateString(getLocation(language), {
        month: 'short',
        year: 'numeric',
      })
      .replace('.', '');
  }
  const money = (value: number): string => formatBRL(value, language);
  if (goalsError || planError) return <p role="alert">{labels.loadError}</p>;
  if (!goals || !plan) return <p role="status">{labels.loading}</p>;
  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 space-y-4 p-3 sm:p-6">
      <h1 className="text-2xl font-bold">{labels.title}</h1>
      {error && <p role="alert">{labels.error}</p>}
      <Panel title={labels.pace} className="min-w-0 space-y-3">
        <p>
          {labels.pace}: {money(plan.pace)}
          {labels.perMonth} ·{' '}
          {plan.paceOverride === null ? labels.average : labels.override}
        </p>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event): void => {
            event.preventDefault();
            void run(async (): Promise<void> => {
              await putFetcher('/goals/pace', {
                body: JSON.stringify({
                  monthlyAmount: Number(pace ?? plan.pace),
                }),
              });
              setPace(null);
            }, false);
          }}
        >
          <Field label={labels.monthly}>
            <NumberInput
              min="0"
              max="999999999999.99"
              required
              step="0.01"
              value={pace ?? plan.pace}
              onChange={(event): void => setPace(event.currentTarget.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {labels.submit}
          </Button>
          <Button
            disabled={busy || plan.paceOverride === null}
            onClick={(): void => {
              void run(async (): Promise<void> => {
                await putFetcher('/goals/pace', {
                  body: JSON.stringify({ monthlyAmount: null }),
                });
                setPace(null);
              }, false);
            }}
          >
            {labels.reset}
          </Button>
        </form>
        <p>
          {labels.reserved}: {money(plan.reserved)} · {labels.free}:{' '}
          {money(
            (accounts ?? []).reduce(
              (total, account): number => total + (account.balance ?? 0),
              0
            ) - plan.reserved
          )}
        </p>
      </Panel>
      <Button
        variant="primary"
        disabled={busy}
        onClick={(): void => setEditor({ kind: 'goal' })}
      >
        {labels.new}
      </Button>
      {editor && (
        <Drawer
          title={editor.kind === 'goal' ? labels.new : editor.goal.name}
          onClose={(): void => setEditor(null)}
        >
          <Panel
            className="space-y-4"
            title={editor.kind === 'goal' ? labels.new : editor.goal.name}
          >
            {editor.kind === 'goal' && (
              <GoalForm
                key={editor.goal?.id ?? 'new'}
                goal={editor.goal}
                busy={busy}
                onCancel={(): void => setEditor(null)}
                onSave={(draft): Promise<void> =>
                  run((): Promise<unknown> =>
                    editor.goal
                      ? putFetcher(`/goals/${editor.goal.id}`, {
                          body: JSON.stringify(draft),
                        })
                      : postFetcher('/goals', { body: JSON.stringify(draft) })
                  )
                }
              />
            )}
            {editor.kind === 'allocation' && (
              <AllocationForm
                key={`${editor.goal.id}-${editor.release}`}
                goal={editor.goal}
                release={editor.release}
                saved={
                  plan.goals.find((item): boolean => item.id === editor.goal.id)
                    ?.saved ?? 0
                }
                busy={busy}
                onCancel={(): void => setEditor(null)}
                onSave={(draft): Promise<void> =>
                  run((): Promise<unknown> =>
                    postFetcher(`/goals/${editor.goal.id}/allocations`, {
                      body: JSON.stringify(draft),
                    })
                  )
                }
              />
            )}
            {editor.kind === 'purchase' && (
              <PurchaseForm
                goal={editor.goal}
                busy={busy}
                onCancel={(): void => setEditor(null)}
                onSave={(draft): Promise<void> =>
                  run((): Promise<unknown> =>
                    postFetcher(`/goals/${editor.goal.id}/purchase`, {
                      body: JSON.stringify(draft),
                    })
                  )
                }
              />
            )}
            {editor.kind === 'delete' && (
              <div className="space-y-3">
                <p>{labels.confirm}</p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={(): void => {
                      void run((): Promise<void> =>
                        deleteFetcher(`/goals/${editor.goal.id}`)
                      );
                    }}
                  >
                    {labels.delete}
                  </Button>
                  <Button disabled={busy} onClick={(): void => setEditor(null)}>
                    {labels.cancel}
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </Drawer>
      )}
      {ranked.length === 0 && (
        <Panel>
          <p>{labels.empty}</p>
        </Panel>
      )}
      <ol className="space-y-3" aria-label={labels.title}>
        {ranked.map((goal, index): JSX.Element => {
          const forecast = plan.goals.find(
            (item): boolean => item.id === goal.id
          );
          const saved = forecast?.saved ?? 0;
          return (
            <Panel
              as="li"
              key={goal.id}
              className="min-w-0 space-y-3 break-words"
              onDragOver={(event): void => event.preventDefault()}
              onDrop={(event): void => {
                event.preventDefault();
                if (dragged && !busy) move(dragged, index + 1);
                setDragged(null);
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <IconButton
                  draggable
                  disabled={busy}
                  aria-label={`${labels.drag}: ${goal.name}`}
                  onDragStart={(): void => setDragged(goal.id)}
                  onDragEnd={(): void => setDragged(null)}
                >
                  <FiMenu />
                </IconButton>
                <span>{index + 1}.</span>
                <h2 className="min-w-0 flex-1 font-semibold">{goal.name}</h2>
                <Badge>
                  {goal.kind === 'NEED' ? labels.need : labels.want}
                </Badge>
                <IconButton
                  aria-label={`${labels.moveUp}: ${goal.name}`}
                  disabled={busy || index === 0}
                  onClick={(): void => move(goal.id, index)}
                >
                  <FiArrowUp />
                </IconButton>
                <IconButton
                  aria-label={`${labels.moveDown}: ${goal.name}`}
                  disabled={busy || index === ranked.length - 1}
                  onClick={(): void => move(goal.id, index + 2)}
                >
                  <FiArrowDown />
                </IconButton>
              </div>
              <p>
                {labels.price}: {money(goal.price)} ·{' '}
                {goal.savingId ? labels.saved : labels.reserved}: {money(saved)}{' '}
                / {money(goal.price)}
              </p>
              <ProgressBar
                success
                label={goal.name}
                value={(saved / goal.price) * 100}
              />
              <p>
                {labels.forecast}:{' '}
                {forecast?.expectedMonth
                  ? month(forecast.expectedMonth)
                  : labels.capped}
              </p>
              {forecast?.late && goal.targetDate && (
                <p className="text-[var(--ctp-peach)]">
                  {labels.warning(
                    month(goal.targetDate.slice(0, 7).replace('/', '-')),
                    forecast.extraMonthlyAmount === null
                      ? null
                      : money(forecast.extraMonthlyAmount)
                  )}{' '}
                  {labels.first}:{' '}
                  {forecast.firstPositionMonth
                    ? month(forecast.firstPositionMonth)
                    : labels.capped}
                </p>
              )}
              {goal.monthlyAmount !== null &&
                goal.monthlyAmount !== undefined && (
                  <p>
                    {labels.monthly}: {money(goal.monthlyAmount)}
                  </p>
                )}
              {goal.savingId && (
                <p>
                  {labels.saving}:{' '}
                  {
                    savings?.find(
                      (saving): boolean => saving.id === goal.savingId
                    )?.name
                  }
                </p>
              )}
              {goal.notes && <p>{goal.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={(): void => setEditor({ kind: 'purchase', goal })}
                >
                  {labels.purchase}
                </Button>
                <Button
                  disabled={busy}
                  onClick={(): void =>
                    setEditor({ kind: 'allocation', goal, release: false })
                  }
                >
                  {labels.save}
                </Button>
                <Button
                  disabled={busy || saved <= 0}
                  onClick={(): void =>
                    setEditor({ kind: 'allocation', goal, release: true })
                  }
                >
                  {labels.release}
                </Button>
                <Button
                  disabled={busy}
                  onClick={(): void => setEditor({ kind: 'goal', goal })}
                >
                  {labels.edit}
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={(): void => setEditor({ kind: 'delete', goal })}
                >
                  {labels.delete}
                </Button>
              </div>
            </Panel>
          );
        })}
      </ol>
      <details>
        <summary>{labels.achieved}</summary>
        <ul className="mt-3 space-y-3">
          {goals
            .filter((goal): boolean => goal.status === 'ACHIEVED')
            .map((goal): JSX.Element => (
              <Panel
                as="li"
                key={goal.id}
                className="min-w-0 space-y-2 break-words"
              >
                <strong>{goal.name}</strong>
                <p>
                  {labels.saved}: {money(goal.savedAtPurchase ?? 0)} ·{' '}
                  {labels.actualPrice}: {money(goal.actualPrice ?? goal.price)}
                </p>
                <p>
                  {goal.achievedAt &&
                    new Date(
                      `${goal.achievedAt.replaceAll('/', '-')}T12:00:00`
                    ).toLocaleDateString(getLocation(language))}
                </p>
              </Panel>
            ))}
        </ul>
      </details>
      <SavingsTips />
    </main>
  );
}
