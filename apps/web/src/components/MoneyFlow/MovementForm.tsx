'use client';
import { useState, type FormEvent, type JSX } from 'react';
import { DatePickerDialog } from '@/components';
import useAccounts from '@/hooks/useAccounts.hook';
import useCards from '@/hooks/useCards.hook';
import useSavings from '@/hooks/useSavings.hook';
import { useI18n } from '@/i18n/useI18n';
import { postFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import {
  formatDate,
  getApiDate,
  parseApiDate,
} from '@/utils/globalFormats.util';
import type { MovementKind, MovementDraft } from '@budget-manager/api-client';
import { field, button, panel } from './styles';
const drawerButton =
  'h-12 w-full cursor-pointer rounded-md bg-[var(--ctp-surface1)] font-bold text-[var(--ctp-text)] hover:bg-[var(--ctp-surface2)] disabled:cursor-not-allowed disabled:opacity-50';
const checkbox = 'h-4 w-4 accent-[var(--ctp-blue)]';
const BILL_MONTHS_BEFORE = 3;
const BILL_MONTHS_AFTER = 1;

/** The card's bill due dates around a day: a few months back and the next one. */
export function billDueDates(dueDay: number, around: Date): Date[] {
  const dates: Date[] = [];
  for (
    let offset = -BILL_MONTHS_BEFORE;
    offset <= BILL_MONTHS_AFTER;
    offset += 1
  ) {
    const lastDay = new Date(
      around.getFullYear(),
      around.getMonth() + offset + 1,
      0
    ).getDate();
    dates.push(
      new Date(
        around.getFullYear(),
        around.getMonth() + offset,
        Math.min(dueDay, lastDay)
      )
    );
  }
  return dates.reverse();
}

export default function MovementForm({
  onClose,
  savingId: fixedSaving,
  initialKind = 'TRANSFER',
  variant = 'panel',
}: {
  onClose: () => void;
  savingId?: string;
  initialKind?: MovementKind;
  variant?: 'drawer' | 'panel';
}): JSX.Element {
  const { t, language } = useI18n();
  const drawer = variant === 'drawer';
  const [pickedDate, setPickedDate] = useState<Date>(new Date());
  const labels = t.moneyFlow;
  const { data: accounts } = useAccounts();
  const { data: cards } = useCards();
  const { data: savings } = useSavings();
  const [kind, setKind] = useState<MovementKind>(initialKind);
  const [date, setDate] = useState(getApiDate(new Date()).replaceAll('/', '-'));
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [card, setCard] = useState('');
  const [bill, setBill] = useState('');
  const [saving, setSaving] = useState(fixedSaving ?? '');
  const [notes, setNotes] = useState('');
  const [opening, setOpening] = useState(false);
  const [funding, setFunding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fromNeeded =
    kind === 'TRANSFER' ||
    kind === 'CARD_BILL_PAYMENT' ||
    (kind === 'INVESTMENT' && !opening);
  const toNeeded = kind === 'TRANSFER' || kind === 'REDEMPTION';
  const savingNeeded = kind === 'INVESTMENT' || kind === 'REDEMPTION';
  const billNeeded =
    kind === 'CARD_BILL_PAYMENT' || (kind === 'TRANSFER' && funding);
  const movementDate: Date = drawer
    ? pickedDate
    : parseApiDate(date.replaceAll('-', '/'));
  const selectedCard = cards?.find((item): boolean => item.id === card);
  const billOptions: Date[] = selectedCard
    ? billDueDates(selectedCard.dueDay, movementDate)
    : [];
  function changeKind(value: MovementKind): void {
    setKind(value);
    setOpening(false);
    setFunding(false);
  }
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const draft: MovementDraft = {
      kind,
      date: getApiDate(movementDate),
      amount: Number(amount),
      fromAccountId: fromNeeded ? from : null,
      toAccountId: toNeeded ? to : null,
      cardId: billNeeded ? card : null,
      billDueDate: billNeeded ? bill : null,
      savingId: savingNeeded ? saving : null,
      opening: kind === 'INVESTMENT' && opening,
      notes: notes.trim() || null,
    };
    try {
      await postFetcher('/movements', { body: JSON.stringify(draft) });
      await refreshMoneyFlow();
      onClose();
    } catch {
      setError(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }
  function accountSelect(
    label: string,
    value: string,
    onChange: (value: string) => void
  ): JSX.Element {
    return (
      <label className="flex flex-col gap-1">
        {label}
        <select
          required
          className={field}
          value={value}
          onChange={(event): void => onChange(event.currentTarget.value)}
        >
          <option value="">{labels.choose}</option>
          {accounts?.map((account): JSX.Element => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <form
      className={drawer ? 'flex w-full flex-col gap-3' : panel}
      onSubmit={save}
    >
      {drawer && (
        <DatePickerDialog date={pickedDate} setDate={setPickedDate} arrows />
      )}
      {!fixedSaving && (
        <label>
          {labels.kind}
          <select
            className={field}
            value={kind}
            onChange={(event): void =>
              changeKind(event.currentTarget.value as MovementKind)
            }
          >
            {(
              [
                'TRANSFER',
                'CARD_BILL_PAYMENT',
                'INVESTMENT',
                'REDEMPTION',
              ] as const
            ).map((value): JSX.Element => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
      )}
      {!drawer && (
        <label>
          {labels.date}
          <input
            className={field}
            required
            type="date"
            value={date}
            onChange={(event): void => setDate(event.currentTarget.value)}
          />
        </label>
      )}
      <label>
        {labels.amount}
        <input
          className={field}
          required
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event): void => setAmount(event.currentTarget.value)}
        />
      </label>
      {kind === 'INVESTMENT' && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={checkbox}
            checked={opening}
            onChange={(event): void => setOpening(event.currentTarget.checked)}
          />
          {labels.opening}
        </label>
      )}
      {fromNeeded && accountSelect(labels.from, from, setFrom)}
      {toNeeded && accountSelect(labels.to, to, setTo)}
      {kind === 'TRANSFER' && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={checkbox}
            checked={funding}
            onChange={(event): void => setFunding(event.currentTarget.checked)}
          />
          {labels.funding}
        </label>
      )}
      {billNeeded && (
        <>
          <label>
            {labels.card}
            <select
              className={field}
              required
              value={card}
              onChange={(event): void => {
                setCard(event.currentTarget.value);
                setBill('');
              }}
            >
              <option value="">{labels.choose}</option>
              {cards?.map((item): JSX.Element => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {labels.bill}
            <select
              className={field}
              required
              disabled={!selectedCard}
              value={bill}
              onChange={(event): void => setBill(event.currentTarget.value)}
            >
              <option value="">{labels.choose}</option>
              {billOptions.map((dueDate): JSX.Element => (
                <option key={getApiDate(dueDate)} value={getApiDate(dueDate)}>
                  {formatDate(dueDate, language)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm">{labels.fundingHelp}</p>
        </>
      )}
      {savingNeeded && !fixedSaving && (
        <label>
          {labels.saving}
          <select
            className={field}
            required
            value={saving}
            onChange={(event): void => setSaving(event.currentTarget.value)}
          >
            <option value="">{labels.choose}</option>
            {savings?.map((item): JSX.Element => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {labels.notes}
        <input
          className={field}
          maxLength={4000}
          value={notes}
          onChange={(event): void => setNotes(event.currentTarget.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className={drawer ? 'flex w-full gap-2' : 'flex gap-2'}>
        <button
          className={drawer ? drawerButton : button}
          disabled={busy}
          type="button"
          onClick={onClose}
        >
          {t.common.cancel}
        </button>
        <button
          className={drawer ? drawerButton : button}
          disabled={busy}
          type="submit"
        >
          {t.common.save}
        </button>
      </div>
    </form>
  );
}
