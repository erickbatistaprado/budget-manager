'use client';

import {
  Panel,
  TextInput,
  Button,
  Field,
  DateField,
  parseFieldDate,
  formatFieldDate,
} from '@/components/ui';
import { useState, type FormEvent, type JSX } from 'react';
import useSWR from 'swr';
import { useI18n } from '@/i18n/useI18n';
import { getFetcher, postFetcher, deleteFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';
import { formatBRL } from '@/utils/analytics.util';
import type {
  BalanceResult,
  BalanceCheckpoint,
} from '@budget-manager/api-client';

export default function BalanceAdjust({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.moneyFlow;
  const [date, setDate] = useState(getApiDate(new Date()).replaceAll('/', '-'));
  const [balance, setBalance] = useState('');
  const [preview, setPreview] = useState<BalanceResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = `/accounts/${accountId}/balance-checkpoints`;
  const { data: checkpoints, mutate } = useSWR(
    path,
    getFetcher<BalanceCheckpoint[]>
  );
  async function save(previewOnly: boolean): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const result = await postFetcher<BalanceResult>(path, {
        body: JSON.stringify({
          date: date.replaceAll('-', '/'),
          balance: Number(balance),
          preview: previewOnly,
        }),
      });
      if (previewOnly) setPreview(result);
      else {
        await refreshMoneyFlow();
        await mutate();
        setPreview(undefined);
      }
    } catch {
      setError(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await deleteFetcher(`${path}/${id}`);
      await refreshMoneyFlow();
      await mutate();
      setPreview(undefined);
    } catch {
      setError(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      className="flex w-full flex-col gap-3"
      role="dialog"
      aria-label={labels.adjust}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event: FormEvent<HTMLFormElement>): void => {
          event.preventDefault();
          void save(true);
        }}
      >
        <Field label={labels.date}>
          <DateField
            required

            value={parseFieldDate(date)}
            onChange={(pickedDate): void => {
              setDate(formatFieldDate(pickedDate));
              setPreview(undefined);
            }}
          />
        </Field>
        <Field label={labels.bankBalance}>
          <TextInput
            required

            type="number"
            step="0.01"
            value={balance}
            onChange={(event): void => {
              setBalance(event.currentTarget.value);
              setPreview(undefined);
            }}
          />
        </Field>
        <Button variant="primary" disabled={busy} type="submit">
          {labels.preview}
        </Button>
        {preview && (
          <>
            <p>
              {labels.computed}: {formatBRL(preview.computed, language)}
            </p>
            <p>
              {labels.difference}: {formatBRL(preview.difference, language)}
            </p>
            <Button
              variant="danger"
              disabled={busy}
              type="button"
              onClick={(): void => {
                void save(false);
              }}
            >
              {t.common.confirm}
            </Button>
          </>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      <h3>{labels.checkpoints}</h3>
      <ul>
        {checkpoints?.map((checkpoint): JSX.Element => (
          <li
            className="flex items-center justify-between gap-2"
            key={checkpoint.id}
          >
            <span>
              {parseApiDate(checkpoint.date).toLocaleDateString(
                language === 'pt' ? 'pt-BR' : 'en-US'
              )}{' '}
              · {formatBRL(checkpoint.balance, language)}
            </span>
            <Button
              variant="danger"
              disabled={busy}
              onClick={(): void => {
                void remove(checkpoint.id);
              }}
            >
              {t.common.delete}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" disabled={busy} onClick={onClose}>
        {t.common.cancel}
      </Button>
    </Panel>
  );
}
