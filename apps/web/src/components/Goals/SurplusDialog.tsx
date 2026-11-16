'use client';
import { useState, type JSX } from 'react';
import useSWR from 'swr';
import type {
  Goal,
  GoalSplit,
  GoalAllocation,
  Movement,
  MovementDraft,
} from '@budget-manager/api-client';
import { Button, Field, Select, MoneyInput, SidePanel } from '@/components/ui';
import useAccounts from '@/hooks/useAccounts.hook';
import useSavings from '@/hooks/useSavings.hook';
import { useI18n } from '@/i18n/useI18n';
import { getFetcher, postFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import { getApiDate } from '@/utils/globalFormats.util';
import { formatBRL } from '@/utils/analytics.util';

export default function SurplusDialog({
  draft,
  onClose,
}: {
  draft: Partial<MovementDraft>;
  onClose: () => void;
}): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.goals;
  const { data: goals } = useSWR('/goals', getFetcher<Goal[]>);
  const { data: accounts } = useAccounts();
  const { data: savings } = useSavings();
  const { data: movements } = useSWR(
    `/movements?startDate=1900%2F01%2F01&endDate=${encodeURIComponent(getApiDate(new Date()))}`,
    getFetcher<Movement[]>
  );
  const [account, setAccount] = useState(draft.fromAccountId ?? '');
  const [saving, setSaving] = useState<string | null>(null);
  const lastSaving = movements
    ?.filter(
      (movement): boolean =>
        movement.kind === 'INVESTMENT' && Boolean(movement.savingId)
    )
    .sort((left, right): number =>
      right.date.localeCompare(left.date)
    )[0]?.savingId;
  const defaultSaving = savings?.some((item): boolean => item.id === lastSaving)
    ? lastSaving
    : '';
  const selectedSaving = saving ?? defaultSaving ?? '';
  const [goalsSaved, setGoalsSaved] = useState(false);
  const reservationGoals = goals?.filter(
    (goal): boolean => goal.status === 'ACTIVE' && !goal.savingId
  );
  const { data: reservations, error: reservationsError } = useSWR(
    reservationGoals
      ? `/goals/month-reservations/${draft.date}/${reservationGoals.map((goal): string => goal.id).join(',')}`
      : null,
    async (): Promise<number> => {
      const histories = await Promise.all(
        (reservationGoals ?? []).map((goal): Promise<GoalAllocation[]> =>
          getFetcher(`/goals/${goal.id}/allocations`)
        )
      );
      return histories
        .flat()
        .filter(
          (allocation): boolean =>
            allocation.date.slice(0, 7) === draft.date?.slice(0, 7)
        )
        .reduce((sum, allocation): number => sum + allocation.amount, 0);
    }
  );
  const amount = Math.max(0, (draft.amount ?? 0) - (reservations ?? 0));
  const previewKey = ['/goals/allocate', draft.date, amount, account];
  const { data: preview, error: previewError } = useSWR(
    reservations !== undefined && amount > 0 ? previewKey : null,
    async (): Promise<GoalSplit> =>
      postFetcher('/goals/allocate', {
        body: JSON.stringify({
          date: draft.date,
          amount,
          fromAccountId: account || null,
          preview: true,
        }),
      })
  );
  const [edited, setEdited] = useState<Record<string, number> | null>(null);
  const [investment, setInvestment] = useState<number | null>(null);
  const lines = edited ?? preview?.goals ?? {};
  const investmentAmount = investment ?? preview?.investmentAmount ?? 0;
  const total =
    Object.values(lines).reduce(
      (sum, value): number => sum + Math.round(value * 100),
      0
    ) + Math.round(investmentAmount * 100);
  const invalid = [...Object.values(lines), investmentAmount].some(
    (value): boolean =>
      !Number.isFinite(value) || value < 0 || value > 999999999999.99
  );
  const needsAccount =
    investmentAmount > 0 ||
    goals?.some(
      (goal): boolean => Boolean(goal.savingId) && (lines[goal.id] ?? 0) > 0
    );
  const remaining = (Math.round(amount * 100) - total) / 100;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function confirm(): Promise<void> {
    if (
      invalid ||
      remaining < 0 ||
      !preview ||
      (investmentAmount > 0 && !selectedSaving)
    )
      return;
    setBusy(true);
    setError(false);
    try {
      if (!goalsSaved) {
        await postFetcher('/goals/allocate', {
          body: JSON.stringify({
            date: draft.date,
            amount,
            fromAccountId: account || null,
            preview: false,
            allocations: lines,
          }),
        });
        setGoalsSaved(true);
      }
      if (investmentAmount > 0)
        await postFetcher('/movements', {
          body: JSON.stringify({
            kind: 'INVESTMENT',
            date: draft.date,
            amount: investmentAmount,
            fromAccountId: account,
            savingId: selectedSaving,
          }),
        });
      await refreshMoneyFlow();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SidePanel title={labels.keep} onClose={onClose}>
      <div className="min-w-0 space-y-3">
        {(previewError || reservationsError || error) && (
          <p role="alert">
            {goalsSaved ? labels.investmentError : labels.error}
          </p>
        )}
        {!preview && !previewError && amount > 0 && (
          <p role="status">{labels.loading}</p>
        )}
        <Field label={labels.account}>
          <Select
            disabled={busy || goalsSaved}
            value={account}
            onChange={(event): void => setAccount(event.currentTarget.value)}
          >
            <option value="">{labels.none}</option>
            {accounts?.map((item): JSX.Element => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        {goals
          ?.filter((goal): boolean => goal.status === 'ACTIVE')
          .map((goal): JSX.Element => (
            <Field key={goal.id} label={goal.name}>
              <MoneyInput
                disabled={busy || goalsSaved}
                min="0"
                value={lines[goal.id] ?? 0}
                onValueChange={(value): void =>
                  setEdited({
                    ...lines,
                    [goal.id]: Number(value),
                  })
                }
              />
            </Field>
          ))}
        <Field label={labels.investment}>
          <MoneyInput
            disabled={busy || goalsSaved}
            min="0"
            value={investmentAmount}
            onValueChange={(value): void => setInvestment(Number(value))}
          />
        </Field>
        <Field label={labels.investInto}>
          <Select
            disabled={busy || goalsSaved}
            value={selectedSaving}
            onChange={(event): void => setSaving(event.currentTarget.value)}
          >
            <option value="">{labels.none}</option>
            {savings?.map((item): JSX.Element => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <p>
          {labels.reserved}: {formatBRL(reservations ?? 0, language)}
        </p>
        <p>
          {labels.total}: {formatBRL(total / 100, language)} /{' '}
          {formatBRL(amount, language)}
        </p>
        <p>
          {labels.unassigned}: {formatBRL(remaining, language)}
        </p>
        {remaining < 0 && <p role="alert">{labels.overLimit}</p>}
        <Button
          variant="primary"
          disabled={
            busy ||
            !preview ||
            invalid ||
            remaining < 0 ||
            total <= 0 ||
            (needsAccount && !account) ||
            (investmentAmount > 0 && !selectedSaving)
          }
          onClick={(): void => {
            void confirm();
          }}
        >
          {goalsSaved ? labels.retryInvestment : labels.submit}
        </Button>
      </div>
    </SidePanel>
  );
}
