'use client';
import { useState, type FormEvent, type JSX } from 'react';
import { Button, Field, Select, DateField, MoneyInput } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import useAccounts from '@/hooks/useAccounts.hook';
import useCurrentUser from '@/hooks/useCurrentUser.hook';
import { getApiDate } from '@/utils/globalFormats.util';
import type { Goal, GoalAllocationDraft } from '@budget-manager/api-client';
export default function AllocationForm({
  goal,
  release,
  saved,
  busy,
  onSave,
  onCancel,
}: {
  goal: Goal;
  release: boolean;
  saved: number;
  busy: boolean;
  onSave: (draft: GoalAllocationDraft) => Promise<void>;
  onCancel: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const labels = t.goals;
  const { data: accounts } = useAccounts();
  const { data: user } = useCurrentUser();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [account, setAccount] = useState<string | null>(null);
  const selectedAccount = account ?? user?.mainAccountId ?? '';
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!date) return;
    void onSave({
      date: getApiDate(date),
      amount: Number(amount) * (release ? -1 : 1),
      fromAccountId: selectedAccount || null,
    });
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label={labels.amount}>
        <MoneyInput
          required
          min="0.01"
          max={release ? saved : '999999999999.99'}
          value={amount}
          onValueChange={setAmount}
        />
      </Field>
      <DateField required label={labels.date} value={date} onChange={setDate} />
      {!release && goal.savingId && (
        <Field label={labels.account}>
          <Select
            required
            value={selectedAccount}
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
      )}
      {release && <p>{labels.releaseHelp}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={busy || !date}>
          {release ? labels.release : labels.save}
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
