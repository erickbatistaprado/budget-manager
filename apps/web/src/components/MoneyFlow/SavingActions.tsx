'use client';
import { useState, type FormEvent, type JSX } from 'react';
import useSWR from 'swr';
import { useI18n } from '@/i18n/useI18n';
import { getFetcher, postFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';
import { formatBRL } from '@/utils/analytics.util';
import type { SavingHistory } from '@budget-manager/api-client';
import MovementForm from './MovementForm';
import { field, button, panel } from './styles';
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
        <button
          className={button}
          onClick={(): void => setAction('INVESTMENT')}
        >
          {labels.invest}
        </button>
        <button
          className={button}
          onClick={(): void => setAction('REDEMPTION')}
        >
          {labels.redeem}
        </button>
        <button className={button} onClick={(): void => setAction('value')}>
          {labels.value}
        </button>
        <button className={button} onClick={(): void => setAction('history')}>
          {labels.history}
        </button>
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
        <form className={panel} onSubmit={save}>
          <label>
            {labels.current}
            <input
              required
              className={field}
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event): void => setValue(event.currentTarget.value)}
            />
          </label>
          <label>
            {labels.date}
            <input
              required
              className={field}
              type="date"
              value={date}
              onChange={(event): void => setDate(event.currentTarget.value)}
            />
          </label>
          <button className={button} disabled={busy} type="submit">
            {t.common.save}
          </button>
          <button
            className={button}
            disabled={busy}
            type="button"
            onClick={(): void => setAction(undefined)}
          >
            {t.common.cancel}
          </button>
        </form>
      )}
      {action === 'history' && (
        <div className={panel}>
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
          <button className={button} onClick={(): void => setAction(undefined)}>
            {t.common.cancel}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
