'use client';

import {
  Button,
  Panel,
  Field,
  DateField,
  parseFieldDate,
  formatFieldDate,
  MoneyInput,
} from '@/components/ui';
import { useState, type FormEvent, type JSX } from 'react';
import useSWR from 'swr';
import { useI18n } from '@/i18n/useI18n';
import { getFetcher, postFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';
import { formatBRL } from '@/utils/analytics.util';
import type { SavingHistory } from '@budget-manager/api-client';
import MovementForm from './MovementForm';

export default function SavingActions({
  savingId,
}: {
  savingId: string;
}): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.moneyFlow;
  const [action, setAction] = useState<
    'INVESTMENT' | 'REDEMPTION' | 'value' | 'history'
  >();
  const [date, setDate] = useState(getApiDate(new Date()).replaceAll('/', '-'));
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data: history, error: historyError } = useSWR(
    action === 'history' ? `/savings/${savingId}/history` : null,
    getFetcher<SavingHistory>
  );
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await postFetcher(`/savings/${savingId}/valuations`, {
        body: JSON.stringify({
          date: date.replaceAll('-', '/'),
          value: Number(value),
        }),
      });
      await refreshMoneyFlow();
      setAction(undefined);
    } catch {
      setError(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={(): void => setAction('INVESTMENT')}
        >
          {labels.invest}
        </Button>
        <Button
          variant="secondary"
          onClick={(): void => setAction('REDEMPTION')}
        >
          {labels.redeem}
        </Button>
        <Button variant="secondary" onClick={(): void => setAction('value')}>
          {labels.value}
        </Button>
        <Button variant="secondary" onClick={(): void => setAction('history')}>
          {labels.history}
        </Button>
      </div>
      {(action === 'INVESTMENT' || action === 'REDEMPTION') && (
        <MovementForm
          key={action}
          savingId={savingId}
          initialKind={action}
          onClose={(): void => setAction(undefined)}
        />
      )}
      {action === 'value' && (
        <Panel className="flex w-full flex-col gap-3" as="form" onSubmit={save}>
          <Field label={labels.current}>
            <MoneyInput
              required
              min="0"
              value={value}
              onValueChange={setValue}
            />
          </Field>
          <Field label={labels.date}>
            <DateField
              required

              value={parseFieldDate(date)}
              onChange={(pickedDate): void =>
                setDate(formatFieldDate(pickedDate))
              }
            />
          </Field>
          <Button variant="primary" disabled={busy} type="submit">
            {t.common.save}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            type="button"
            onClick={(): void => setAction(undefined)}
          >
            {t.common.cancel}
          </Button>
        </Panel>
      )}
      {action === 'history' && (
        <Panel className="flex w-full flex-col gap-3">
          <h4>{labels.history}</h4>
          {historyError && <p role="alert">{t.common.errorGeneric}</p>}
          <ul>
            {[
              ...(history?.movements.map((movement) => ({
                key: movement.id ?? movement.date,
                date: movement.date,
                label: labels[movement.kind],
                amount: movement.amount,
              })) ?? []),
              ...(history?.valuations.map((valuation) => ({
                key: valuation.id,
                date: valuation.date,
                label: labels.valuation,
                amount: valuation.value,
              })) ?? []),
            ]
              .sort(
                (first, second): number =>
                  parseApiDate(first.date).getTime() -
                  parseApiDate(second.date).getTime()
              )
              .map((entry): JSX.Element => (
                <li key={entry.key}>
                  {parseApiDate(entry.date).toLocaleDateString(
                    language === 'pt' ? 'pt-BR' : 'en-US'
                  )}{' '}
                  · {entry.label} · {formatBRL(entry.amount, language)}
                </li>
              ))}
          </ul>
          <Button
            variant="secondary"
            onClick={(): void => setAction(undefined)}
          >
            {t.common.cancel}
          </Button>
        </Panel>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
