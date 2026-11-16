'use client';

import {
  Panel,
  TextInput,
  NumberInput,
  Select,
  Button,
  Field,
} from '@/components/ui';
import CardLimit from '@/components/Bank/CardLimit';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import useAccounts from '@/hooks/useAccounts.hook';
import useCards from '@/hooks/useCards.hook';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import { useI18n } from '@/i18n/useI18n';
import { deleteFetcher, postFetcher, putFetcher } from '@/libs/fetchers.lib';
import AccountsSection from '@/components/Accounts/AccountsSection';
import { BankSelect, BankBadge } from '@/components/Bank/Bank';
import { Bank, type Card } from '@budget-manager/api-client';
import { useState, type FormEvent, type JSX } from 'react';

export default function CardsPage(): JSX.Element {
  const { t } = useI18n();
  const { data: cards, error, mutate } = useCards();
  const { data: accounts } = useAccounts();
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [billPaymentMethod, setBillPaymentMethod] = useState('');
  const [fundingAccountId, setFundingAccountId] = useState('');
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState('');
  const [bank, setBank] = useState(Bank.OTHER);
  const [closingDay, setClosingDay] = useState('25');
  const [dueDay, setDueDay] = useState('5');
  const [creditLimit, setCreditLimit] = useState('');
  const [deleting, setDeleting] = useState<string>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setPaymentAccountId('');
    setBillPaymentMethod('');
    setFundingAccountId('');
    setEditing(undefined);
    setName('');
    setBank(Bank.OTHER);
    setClosingDay('25');
    setDueDay('5');
    setCreditLimit('');
    setMessage('');
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const closing = Number(closingDay);
    const due = Number(dueDay);
    if (
      !name.trim() ||
      ![closing, due].every(
        (day): boolean => Number.isInteger(day) && day >= 1 && day <= 31
      )
    ) {
      setMessage(t.cards.validation);
      return;
    }
    if (
      creditLimit &&
      (!Number.isFinite(Number(creditLimit)) ||
        Number(creditLimit) <= 0 ||
        !/^\d+(\.\d{1,2})?$/.test(creditLimit))
    ) {
      setMessage(t.cards.limitValidation);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const body = JSON.stringify({
        name: name.trim(),
        bank,
        closingDay: closing,
        dueDay: due,
        creditLimit: creditLimit ? Number(creditLimit) : null,
        paymentAccountId: paymentAccountId || null,
        billPaymentMethod: paymentAccountId ? billPaymentMethod || null : null,
        fundingAccountId: fundingAccountId || null,
      });
      if (editing) {
        await putFetcher<Card>(`/cards/${editing}`, { body });
      } else {
        await postFetcher<Card>('/cards', { body });
      }
      await refreshMoneyFlow();
      await mutate();
      reset();
    } catch {
      setMessage(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      await deleteFetcher(`/cards/${id}`);
      await refreshTransactions();
      await refreshMoneyFlow();
      await mutate();
      setDeleting(undefined);
      if (editing === id) {
        reset();
      }
    } catch {
      setMessage(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-5">
      <h1 className="text-xl font-semibold">{t.cards.title}</h1>
      <h2 className="text-lg font-semibold">{t.payments.cards}</h2>
      <Panel
        as="form"
        onSubmit={save}
        noValidate
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4"
      >
        <Field label={t.common.name} className="sm:col-span-4">
          <TextInput
            value={name}
            maxLength={255}
            onChange={(event): void => setName(event.currentTarget.value)}
          />
        </Field>
        <Field label={t.cards.closingDay}>
          <TextInput
            type="number"
            min={1}
            max={31}
            value={closingDay}
            onChange={(event): void => setClosingDay(event.currentTarget.value)}
          />
        </Field>
        <Field label={t.cards.dueDay}>
          <TextInput
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(event): void => setDueDay(event.currentTarget.value)}
          />
        </Field>
        <BankSelect bank={bank} onChange={setBank} />
        <Field label={t.cards.creditLimit}>
          <NumberInput
            min="0.01"
            step="0.01"
            value={creditLimit}
            onChange={(event): void =>
              setCreditLimit(event.currentTarget.value)
            }
          />
        </Field>
        <Field label={t.moneyFlow.paymentAccount} className="sm:col-span-2">
          <Select
            value={paymentAccountId}
            onChange={(event): void => {
              setPaymentAccountId(event.currentTarget.value);
              setFundingAccountId('');
              setBillPaymentMethod('');
            }}
          >
            <option value="">{t.moneyFlow.none}</option>
            {accounts?.map((account): JSX.Element => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>
        {paymentAccountId && (
          <Field label={t.cards.billPaymentMethod}>
            <Select
              value={billPaymentMethod}
              onChange={(event): void =>
                setBillPaymentMethod(event.currentTarget.value)
              }
            >
              <option value="">{t.moneyFlow.none}</option>
              {(
                [
                  'PIX',
                  'BANK_TRANSFER',
                  'BOLETO',
                  'AUTOMATIC_DEBIT',
                  'OTHER',
                ] as const
              ).map((method): JSX.Element => (
                <option key={method} value={method}>
                  {t.payments.methods[method]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t.moneyFlow.fundingAccount}>
          <Select
            disabled={!paymentAccountId}
            value={fundingAccountId}
            onChange={(event): void =>
              setFundingAccountId(event.currentTarget.value)
            }
          >
            <option value="">{t.moneyFlow.none}</option>
            {accounts
              ?.filter((account): boolean => account.id !== paymentAccountId)
              .map((account): JSX.Element => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </Select>
        </Field>
        <Button variant="primary" size="lg" disabled={busy} type="submit">
          {editing ? t.common.save : t.cards.add}
        </Button>
        {editing && (
          <Button
            variant="secondary"
            type="button"
            disabled={busy}
            onClick={reset}
          >
            {t.common.cancel}
          </Button>
        )}
      </Panel>
      {(message || error) && (
        <p role="alert">{message || t.common.errorGeneric}</p>
      )}
      <ul className="flex flex-col gap-3">
        {cards?.map((card): JSX.Element => (
          <Panel
            as="li"
            key={card.id}
            className="flex flex-wrap items-center gap-3"
          >
            <div className="flex-1">
              <strong>{card.name}</strong> <BankBadge bank={card.bank} />
              <p className="text-sm">
                {t.cards.schedule(card.closingDay, card.dueDay)}
              </p>
              <CardLimit
                creditLimit={card.creditLimit}
                availableLimit={card.availableLimit}
                showBar
              />
              <p className="text-sm">
                {t.moneyFlow.paymentAccount}:{' '}
                {card.paymentAccount?.name ?? t.moneyFlow.none}
              </p>
              {card.fundingAccount && (
                <p className="text-sm">
                  {t.moneyFlow.fundingAccount}: {card.fundingAccount.name}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={(): void => {
                setPaymentAccountId(card.paymentAccount?.id ?? '');
                setBillPaymentMethod(card.billPaymentMethod ?? '');
                setFundingAccountId(card.fundingAccount?.id ?? '');
                setEditing(card.id);
                setName(card.name);
                setBank(card.bank);
                setClosingDay(String(card.closingDay));
                setDueDay(String(card.dueDay));
                setCreditLimit(
                  card.creditLimit === null || card.creditLimit === undefined
                    ? ''
                    : String(card.creditLimit)
                );
              }}
            >
              {t.common.edit}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={(): void => setDeleting(card.id)}
            >
              {t.common.delete}
            </Button>
            {deleting === card.id && (
              <div
                role="alertdialog"
                aria-label={t.cards.deleteConfirmation(card.name)}
                className="flex w-full flex-wrap items-center gap-3"
              >
                <p>{t.cards.deleteConfirmation(card.name)}</p>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={(): void => {
                    void remove(card.id);
                  }}
                >
                  {t.common.confirm}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={(): void => setDeleting(undefined)}
                >
                  {t.common.cancel}
                </Button>
              </div>
            )}
          </Panel>
        ))}
      </ul>
      <AccountsSection />
    </div>
  );
}
