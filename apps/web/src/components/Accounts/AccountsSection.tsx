'use client';

import { Panel, TextInput, Button, Field } from '@/components/ui';
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
      <h2 className="text-lg font-semibold">{t.payments.accounts}</h2>
      <Panel
        as="form"
        onSubmit={save}
        noValidate
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4"
      >
        <Field label={t.common.name} className="sm:col-span-2">
          <TextInput
            value={name}
            maxLength={255}
            onChange={(event): void => setName(event.currentTarget.value)}
          />
        </Field>
        <BankSelect bank={bank} onChange={setBank} />
        <Button variant="primary" size="field" disabled={busy} type="submit">
          {editing ? t.common.save : t.payments.addAccount}
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
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accounts?.map((account): JSX.Element => (
          <Panel
            as="li"
            key={account.id}
            className="flex flex-wrap content-between items-center gap-3"
          >
            <div className="min-w-0 flex-1 basis-full">
              <strong>{account.name}</strong>
              <p>
                {t.moneyFlow.balance}:{' '}
                {formatBRL(account.balance ?? 0, language)}
              </p>
              <p className="text-sm">
                <BankBadge bank={account.bank} />
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={(): void => {
                setEditing(account.id);
                setName(account.name);
                setBank(account.bank);
              }}
            >
              {t.common.edit}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={(): void => setDeleting(account.id)}
            >
              {t.common.delete}
            </Button>
            <Button
              variant="ghost"
              onClick={(): void => setAdjusting(account.id)}
            >
              {t.moneyFlow.adjust}
            </Button>
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
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={(): void => {
                    void remove(account.id);
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
    </section>
  );
}
