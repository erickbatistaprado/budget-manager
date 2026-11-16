'use client';
import { useState, type FormEvent, type JSX } from 'react';
import {
  Button,
  Field,
  TextInput,
  NumberInput,
  Select,
  DateField,
} from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import useSavings from '@/hooks/useSavings.hook';
import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';
import type { Goal, GoalDraft } from '@budget-manager/api-client';

export default function GoalForm({
  goal,
  busy,
  onSave,
  onCancel,
}: {
  goal?: Goal;
  busy: boolean;
  onSave: (draft: GoalDraft) => Promise<void>;
  onCancel: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const labels = t.goals;
  const { data: savings } = useSavings();
  const [name, setName] = useState(goal?.name ?? '');
  const [price, setPrice] = useState(goal?.price.toString() ?? '');
  const [kind, setKind] = useState<GoalDraft['kind']>(goal?.kind ?? 'WANT');
  const [target, setTarget] = useState<Date | null>(
    goal?.targetDate ? parseApiDate(goal.targetDate) : null
  );
  const [monthly, setMonthly] = useState(goal?.monthlyAmount?.toString() ?? '');
  const [saving, setSaving] = useState(goal?.savingId ?? '');
  const [link, setLink] = useState(goal?.link ?? '');
  const [notes, setNotes] = useState(goal?.notes ?? '');
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onSave({
      name: name.trim(),
      price: Number(price),
      kind,
      targetDate: target ? getApiDate(target) : null,
      monthlyAmount: monthly === '' ? null : Number(monthly),
      savingId: saving || null,
      link: link || null,
      notes: notes || null,
    });
  }
  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Field label={labels.name}>
        <TextInput
          required
          maxLength={255}
          value={name}
          onChange={(event): void => setName(event.currentTarget.value)}
        />
      </Field>
      <Field label={labels.price}>
        <NumberInput
          required
          min="0.01"
          max="999999999999.99"
          step="0.01"
          value={price}
          onChange={(event): void => setPrice(event.currentTarget.value)}
        />
      </Field>
      <Field label={labels.kind}>
        <Select
          value={kind}
          onChange={(event): void =>
            setKind(event.currentTarget.value as GoalDraft['kind'])
          }
        >
          <option value="NEED">{labels.need}</option>
          <option value="WANT">{labels.want}</option>
        </Select>
      </Field>
      <DateField label={labels.target} value={target} onChange={setTarget} />
      <Field label={labels.monthly}>
        <NumberInput
          min="0"
          max="999999999999.99"
          step="0.01"
          value={monthly}
          onChange={(event): void => setMonthly(event.currentTarget.value)}
        />
      </Field>
      <Field label={labels.saving}>
        <Select
          value={saving}
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
      <Field label={labels.link}>
        <TextInput
          maxLength={2000}
          value={link}
          onChange={(event): void => setLink(event.currentTarget.value)}
        />
      </Field>
      <Field label={labels.notes}>
        <TextInput
          maxLength={4000}
          value={notes}
          onChange={(event): void => setNotes(event.currentTarget.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
          {labels.submit}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
