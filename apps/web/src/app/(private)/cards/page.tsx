'use client';

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

const field =
  'rounded border border-[var(--ctp-surface2)] bg-[var(--ctp-base)] p-2';
const button = 'rounded bg-[var(--ctp-surface1)] px-3 py-2 disabled:opacity-50';

export default function CardsPage(): JSX.Element {
  const { t } = useI18n();
  const { data: cards, error, mutate } = useCards();
  const { data: accounts } = useAccounts();
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [fundingAccountId, setFundingAccountId] = useState('');
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState('');
  const [bank, setBank] = useState(Bank.OTHER);
  const [closingDay, setClosingDay] = useState('25');
  const [dueDay, setDueDay] = useState('5');
  const [deleting, setDeleting] = useState<string>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setPaymentAccountId('');
    setFundingAccountId('');
    setEditing(undefined);
    setName('');
    setBank(Bank.OTHER);
    setClosingDay('25');
    setDueDay('5');
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
    setBusy(true);
    setMessage('');
    try {
      const body = JSON.stringify({
        name: name.trim(),
        bank,
        closingDay: closing,
        dueDay: due,
        paymentAccountId: paymentAccountId || null,
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
      <form
        onSubmit={save}
        noValidate
        className="flex flex-wrap items-end gap-3 rounded bg-[var(--ctp-surface0)] p-4"
      >
        <label className="flex flex-col gap-1">
          {t.common.name}
          <input
            className={field}
            value={name}
            maxLength={255}
            onChange={(event): void => setName(event.currentTarget.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t.cards.closingDay}
          <input
            className={field}
            type="number"
            min={1}
            max={31}
            value={closingDay}
            onChange={(event): void => setClosingDay(event.currentTarget.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t.cards.dueDay}
          <input
            className={field}
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(event): void => setDueDay(event.currentTarget.value)}
          />
        </label>
        <BankSelect bank={bank} onChange={setBank} />
        <label className="flex flex-col gap-1">
          {t.moneyFlow.paymentAccount}
          <select
            className={field}
            value={paymentAccountId}
            onChange={(event): void => {
              setPaymentAccountId(event.currentTarget.value);
              setFundingAccountId('');
            }}
          >
            <option value="">{t.moneyFlow.none}</option>
            {accounts?.map((account): JSX.Element => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t.moneyFlow.fundingAccount}
          <select
            className={field}
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
          </select>
        </label>
        <button className={button} disabled={busy} type="submit">
          {editing ? t.common.save : t.cards.add}
        </button>
        {editing && (
          <button
            className={button}
            type="button"
            disabled={busy}
            onClick={reset}
          >
            {t.common.cancel}
          </button>
        )}
      </form>
      {(message || error) && (
        <p role="alert">{message || t.common.errorGeneric}</p>
      )}
      <ul className="flex flex-col gap-3">
        {cards?.map((card): JSX.Element => (
          <li
            key={card.id}
            className="flex flex-wrap items-center gap-3 rounded bg-[var(--ctp-surface0)] p-4"
          >
            <div className="flex-1">
              <strong>{card.name}</strong> <BankBadge bank={card.bank} />
              <p className="text-sm">
                {t.cards.schedule(card.closingDay, card.dueDay)}
              </p>
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
            <button
              className={button}
              disabled={busy}
              onClick={(): void => {
                setPaymentAccountId(card.paymentAccount?.id ?? '');
                setFundingAccountId(card.fundingAccount?.id ?? '');
                setEditing(card.id);
                setName(card.name);
                setBank(card.bank);
                setClosingDay(String(card.closingDay));
                setDueDay(String(card.dueDay));
              }}
            >
              {t.common.edit}
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={(): void => setDeleting(card.id)}
            >
              {t.common.delete}
            </button>
            {deleting === card.id && (
              <div
                role="alertdialog"
                aria-label={t.cards.deleteConfirmation(card.name)}
                className="flex w-full flex-wrap items-center gap-3"
              >
                <p>{t.cards.deleteConfirmation(card.name)}</p>
                <button
                  className={button}
                  disabled={busy}
                  onClick={(): void => {
                    void remove(card.id);
                  }}
                >
                  {t.common.confirm}
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={(): void => setDeleting(undefined)}
                >
                  {t.common.cancel}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <AccountsSection />
    </div>
  );
}
