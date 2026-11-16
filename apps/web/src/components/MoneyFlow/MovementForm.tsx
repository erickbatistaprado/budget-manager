'use client';

import {
  Select,
  Panel,
  TextInput,
  Checkbox,
  Button,
  Field,
  DateField,
  parseFieldDate,
  formatFieldDate,
  MoneyInput,
} from '@/components/ui';
import { useState, type FormEvent, type JSX } from 'react';
import useCurrentUser from '@/hooks/useCurrentUser.hook';
import useAccounts from '@/hooks/useAccounts.hook';
import useCards from '@/hooks/useCards.hook';
import useSavings from '@/hooks/useSavings.hook';
import { useI18n } from '@/i18n/useI18n';
import { postFetcher, putFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import {
  formatDate,
  getApiDate,
  parseApiDate,
} from '@/utils/globalFormats.util';
import type { MovementKind, MovementDraft } from '@budget-manager/api-client';

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
  initialDraft,
  movementId,
}: {
  onClose: () => void;
  savingId?: string;
  initialKind?: MovementKind;
  variant?: 'drawer' | 'panel';
  initialDraft?: Partial<MovementDraft>;
  movementId?: string;
}): JSX.Element {
  const { t, language } = useI18n();
  const drawer = variant === 'drawer';
  const [pickedDate, setPickedDate] = useState<Date>(
    initialDraft?.date ? parseApiDate(initialDraft.date) : new Date()
  );
  const labels = t.moneyFlow;
  const { data: user } = useCurrentUser();
  const { data: accounts } = useAccounts();
  const { data: cards } = useCards();
  const { data: savings } = useSavings();
  const [kind, setKind] = useState<MovementKind>(initialKind);
  const [date, setDate] = useState(
    (initialDraft?.date ?? getApiDate(new Date())).replaceAll('/', '-')
  );
  const [amount, setAmount] = useState(initialDraft?.amount?.toString() ?? '');
  const [from, setFrom] = useState(
    initialDraft?.fromAccountId ?? user?.mainAccountId ?? ''
  );
  const [to, setTo] = useState(initialDraft?.toAccountId ?? '');
  const [card, setCard] = useState(initialDraft?.cardId ?? '');
  const [bill, setBill] = useState(initialDraft?.billDueDate ?? '');
  const [saving, setSaving] = useState(
    fixedSaving ?? initialDraft?.savingId ?? ''
  );
  const [notes, setNotes] = useState(initialDraft?.notes ?? '');
  const [paymentMethod, setPaymentMethod] = useState<
    NonNullable<MovementDraft['paymentMethod']> | ''
  >(initialDraft?.paymentMethod ?? '');
  const [opening, setOpening] = useState(initialDraft?.opening ?? false);
  const [funding, setFunding] = useState(
    initialKind === 'TRANSFER' && Boolean(initialDraft?.cardId)
  );
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
    setPaymentMethod('');
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
      paymentMethod: paymentMethod || null,
    };
    try {
      const write = movementId ? putFetcher : postFetcher;
      await write(movementId ? `/movements/${movementId}` : '/movements', {
        body: JSON.stringify(draft),
      });
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
      <Field label={label}>
        <Select
          required

          value={value}
          onChange={(event): void => onChange(event.currentTarget.value)}
        >
          <option value="">{labels.choose}</option>
          {accounts?.map((account): JSX.Element => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  return (
    <Panel
      as="form"
      className={
        drawer
          ? 'flex w-full flex-col gap-3 border-0 bg-transparent p-0'
          : 'flex w-full flex-col gap-3'
      }
      onSubmit={save}
    >
      {drawer && (
        <DateField
          label={language === 'pt' ? 'Data' : 'Date'}
          value={pickedDate}
          onChange={(value): void => {
            if (value) setPickedDate(value);
          }}
        />
      )}
      {!fixedSaving && (
        <Field label={labels.kind}>
          <Select
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
          </Select>
        </Field>
      )}
      {!drawer && (
        <Field label={labels.date}>
          <DateField
            required

            value={parseFieldDate(date)}
            onChange={(pickedDate): void =>
              setDate(formatFieldDate(pickedDate))
            }
          />
        </Field>
      )}
      <Field label={labels.amount}>
        <MoneyInput
          required
          min="0.01"
          value={amount}
          onValueChange={setAmount}
        />
      </Field>
      {kind === 'INVESTMENT' && (
        <Checkbox
          label={labels.opening}

          checked={opening}
          onChange={(event): void => setOpening(event.currentTarget.checked)}
        />
      )}
      {fromNeeded && accountSelect(labels.from, from, setFrom)}
      {toNeeded && accountSelect(labels.to, to, setTo)}
      {kind === 'TRANSFER' && (
        <Checkbox
          label={labels.funding}

          checked={funding}
          onChange={(event): void => setFunding(event.currentTarget.checked)}
        />
      )}
      {billNeeded && (
        <>
          <Field label={labels.card}>
            <Select
              required
              value={card}
              onChange={(event): void => {
                setCard(event.currentTarget.value);
                if (kind === 'CARD_BILL_PAYMENT') {
                  const chosen = cards?.find(
                    (item): boolean => item.id === event.currentTarget.value
                  );
                  setPaymentMethod(chosen?.billPaymentMethod ?? '');
                  setFrom(chosen?.paymentAccount?.id ?? '');
                }
                setBill('');
              }}
            >
              <option value="">{labels.choose}</option>
              {cards?.map((item): JSX.Element => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={labels.bill}>
            <Select
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
            </Select>
          </Field>
          <p className="text-sm">{labels.fundingHelp}</p>
        </>
      )}
      {savingNeeded && !fixedSaving && (
        <Field label={labels.saving}>
          <Select
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
          </Select>
        </Field>
      )}
      {(kind === 'TRANSFER' || kind === 'CARD_BILL_PAYMENT') && (
        <Field label={t.payments.method}>
          <Select
            value={paymentMethod}
            onChange={(event): void =>
              setPaymentMethod(
                event.currentTarget.value as
                  NonNullable<MovementDraft['paymentMethod']> | ''
              )
            }
          >
            <option value="">{labels.none}</option>
            {(
              [
                'PIX',
                'BANK_TRANSFER',
                'BOLETO',
                'AUTOMATIC_DEBIT',
                'OTHER',
              ] as const
            )
              .filter(
                (method): boolean =>
                  kind === 'CARD_BILL_PAYMENT' ||
                  !['BOLETO', 'AUTOMATIC_DEBIT'].includes(method)
              )
              .map((method): JSX.Element => (
                <option key={method} value={method}>
                  {t.payments.methods[method]}
                </option>
              ))}
          </Select>
        </Field>
      )}
      <Field label={labels.notes}>
        <TextInput
          maxLength={4000}
          value={notes}
          onChange={(event): void => setNotes(event.currentTarget.value)}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      <div className={drawer ? 'flex w-full gap-2' : 'flex gap-2'}>
        <Button
          variant="secondary"
          size={drawer ? 'lg' : 'md'}
          fullWidth={drawer}
          disabled={busy}
          type="button"
          onClick={onClose}
        >
          {t.common.cancel}
        </Button>
        <Button
          variant="primary"
          size={drawer ? 'lg' : 'md'}
          fullWidth={drawer}
          disabled={busy}
          type="submit"
        >
          {t.common.save}
        </Button>
      </div>
    </Panel>
  );
}
