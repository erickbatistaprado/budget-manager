'use client';

import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import BalanceAdjust from '@/components/MoneyFlow/BalanceAdjust';
import { formatBRL } from '@/utils/analytics.util';
import useAccounts from '@/hooks/useAccounts.hook';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import { useI18n } from '@/i18n/useI18n';
import { deleteFetcher, postFetcher, putFetcher } from '@/libs/fetchers.lib';
import { Bank, type Account } from '@budget-manager/api-client';
import { BankSelect, BankBadge } from '@/components/Bank/Bank';
import { useState, type FormEvent, type JSX } from 'react';

const field =
  'rounded border border-[var(--ctp-surface2)] bg-[var(--ctp-base)] p-2';
const button = 'rounded bg-[var(--ctp-surface1)] px-3 py-2 disabled:opacity-50';

export default function AccountsSection(): JSX.Element {
  const { t, language } = useI18n();
  const [adjusting, setAdjusting] = useState<string>();
  const { data: accounts, error, mutate } = useAccounts();
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState('');
  const [bank, setBank] = useState(Bank.OTHER);
  const [deleting, setDeleting] = useState<string>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setEditing(undefined);
    setName('');
    setBank(Bank.OTHER);
    setMessage('');
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      setMessage(t.payments.accountValidation);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const body = JSON.stringify({
        name: name.trim(),
        bank,
      });
      if (editing) {
        await putFetcher<Account>(`/accounts/${editing}`, { body });
      } else {
        await postFetcher<Account>('/accounts', { body });
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
      await deleteFetcher(`/accounts/${id}`);
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
    <section className="flex w-full flex-col gap-5">
      <h2 className="text-xl font-semibold">{t.payments.accounts}</h2>
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
        <BankSelect bank={bank} onChange={setBank} />
        <button className={button} disabled={busy} type="submit">
          {editing ? t.common.save : t.payments.addAccount}
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
        {accounts?.map((account): JSX.Element => (
          <li
            key={account.id}
            className="flex flex-wrap items-center gap-3 rounded bg-[var(--ctp-surface0)] p-4"
          >
            <div className="flex-1">
              <strong>{account.name}</strong>
              <p>
                {t.moneyFlow.balance}:{' '}
                {formatBRL(account.balance ?? 0, language)}
              </p>
              <p className="text-sm">
                <BankBadge bank={account.bank} />
              </p>
            </div>
            <button
              className={button}
              disabled={busy}
              onClick={(): void => {
                setEditing(account.id);
                setName(account.name);
                setBank(account.bank);
              }}
            >
              {t.common.edit}
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={(): void => setDeleting(account.id)}
            >
              {t.common.delete}
            </button>
            <button
              className={button}
              onClick={(): void => setAdjusting(account.id)}
            >
              {t.moneyFlow.adjust}
            </button>
            {adjusting === account.id && (
              <BalanceAdjust
                accountId={account.id}
                onClose={(): void => setAdjusting(undefined)}
              />
            )}
            {deleting === account.id && (
              <div
                role="alertdialog"
                aria-label={t.payments.deleteAccount(account.name)}
                className="flex w-full flex-wrap items-center gap-3"
              >
                <p>{t.payments.deleteAccount(account.name)}</p>
                <button
                  className={button}
                  disabled={busy}
                  onClick={(): void => {
                    void remove(account.id);
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
    </section>
  );
}
