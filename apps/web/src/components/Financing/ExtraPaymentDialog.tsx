'use client';

import {
  Panel,
  Button,
  Field,
  DateField,
  parseFieldDate,
  formatFieldDate,
  MoneyInput,
} from '@/components/ui';
import { useState, type JSX } from 'react';
import type { FinancingSimulation } from '@budget-manager/api-client';
import { postFetcher } from '@/libs/fetchers.lib';
import { useI18n } from '@/i18n/useI18n';
import { getApiDate } from '@/utils/globalFormats.util';

interface Props {
  id: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}
export default function ExtraPaymentDialog({
  id,
  onClose,
  onSaved,
}: Props): JSX.Element {
  const { t, language } = useI18n();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getApiDate(new Date()).replaceAll('/', '-'));
  const [results, setResults] = useState<FinancingSimulation[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const money = new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
  });
  async function submit(option?: FinancingSimulation['option']): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      const body = JSON.stringify({
        amount: Number(amount),
        date: date.replaceAll('-', '/'),
        option,
      });
      if (option) {
        await postFetcher(`/financings/${id}/extra-payments`, { body });
        await onSaved();
        onClose();
      } else {
        setResults(
          await postFetcher<FinancingSimulation[]>(
            `/financings/${id}/extra-payments/simulate`,
            { body }
          )
        );
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/60 p-4">
      <Panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-title"
        className="mx-auto flex max-w-2xl flex-col gap-4"
      >
        <h2 id="extra-title">{t.financing.extra}</h2>
        <Field label={t.financing.adjustmentAmount}>
          <MoneyInput
            autoFocus
            disabled={busy}
            min="0.01"
            value={amount}
            onValueChange={(value): void => {
              setAmount(value);
              setResults(undefined);
            }}
          />
        </Field>
        <Field label={t.financing.date}>
          <DateField
            disabled={busy}

            value={parseFieldDate(date)}
            onChange={(pickedDate): void => {
              setDate(formatFieldDate(pickedDate));
              setResults(undefined);
            }}
          />
        </Field>
        <Button
          variant="secondary"
          disabled={busy || Number(amount) <= 0}
          onClick={(): void => {
            void submit();
          }}
        >
          {t.financing.simulate}
        </Button>
        {error && <p role="alert">{t.financing.error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {results?.map((result): JSX.Element => (
            <Panel
              as="section"

              key={result.option}
            >
              <h3>{t.financing[result.option]}</h3>
              <p>
                {t.financing.term}: {result.schedule.length}
              </p>
              <p>
                {t.financing.payment}:{' '}
                {money.format(
                  result.schedule.find(
                    (row): boolean => row.dueDate > date.replaceAll('-', '/')
                  )?.payment ?? 0
                )}
              </p>
              <p>
                {t.financing.savings}: {money.format(result.interestSaved)}
              </p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={(): void => {
                  void submit(result.option);
                }}
              >
                {t.financing.confirm}
              </Button>
            </Panel>
          ))}
        </div>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t.financing.cancel}
        </Button>
      </Panel>
    </div>
  );
}
