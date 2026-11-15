'use client';
import { use, useState, type JSX, type FormEvent } from 'react';
import useSWR from 'swr';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import type { Financing } from '@budget-manager/api-client';
import { getFetcher, postFetcher } from '@/libs/fetchers.lib';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import { useI18n } from '@/i18n/useI18n';
import { parseApiDate, getApiDate } from '@/utils/globalFormats.util';
import { formatCompactBRL } from '@/utils/analytics.util';
import clsx from 'clsx';
import { financingSummary } from '@/utils/financing.util';
import ExtraPaymentDialog from '@/components/Financing/ExtraPaymentDialog';
import { button, field, panel } from '@/components/Financing/styles';

export default function FinancingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  const { t, language } = useI18n();
  const { data, error, mutate } = useSWR(
    `/financings/${id}`,
    getFetcher<Financing>
  );
  const [action, setAction] = useState<'extra' | 'sync' | 'day' | 'paid'>();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getApiDate(new Date()).replaceAll('/', '-'));
  const [number, setNumber] = useState(1);
  const [day, setDay] = useState(7);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const money = new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
  });
  async function refresh(): Promise<void> {
    await mutate();
    await refreshTransactions();
  }
  async function adjust(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      let path = 'balance-syncs';
      let body: object = {
        date: date.replaceAll('-', '/'),
        amount: Number(amount),
      };
      if (action === 'day') {
        path = 'due-day-changes';
        body = { fromInstallment: number, dueDay: day };
      }
      if (action === 'paid') {
        path = `installments/${number}/paid`;
        body = { amount: Number(amount) };
      }
      await postFetcher(`/financings/${id}/${path}`, {
        body: JSON.stringify(body),
      });
      await refresh();
      setAction(undefined);
      setMessage('');
    } catch {
      setMessage(t.financing.error);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="p-4">
        {error ? t.financing.error : t.financing.loading}
      </main>
    );
  const rows = data.calculation.schedule;
  const summary = financingSummary(rows, data.extraPaid, data.payoffDate);
  const current = rows.find(
    (row): boolean => row.paidAmount === null || row.paidAmount === undefined
  )?.number;
  let actionTitle = t.financing.sync;
  if (action === 'day') actionTitle = t.financing.changeDay;
  if (action === 'paid') actionTitle = t.financing.recordPaid;
  const progress = Math.max(
    0,
    Math.min(100, (1 - summary.outstanding / data.contract.amount) * 100)
  );
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const rate = (value: number): string =>
    new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(value);
  const hasInsurance = rows.some((row): boolean => row.insurance > 0);
  const hasFees = rows.some((row): boolean => row.fees > 0);
  const balanceDates = rows.map((row): Date => parseApiDate(row.dueDate));
  const balanceValues = rows.map((row): number => row.balance);
  if (rows.length === 0 || (rows.at(-1)?.balance ?? 0) > 0) {
    balanceDates.push(parseApiDate(data.payoffDate));
    balanceValues.push(0);
  }
  const cards: [string, string][] = [
    [t.financing.outstanding, money.format(summary.outstanding)],
    [t.financing.paid, money.format(summary.paid)],
    [t.financing.interestPaid, money.format(summary.interestPaid)],
    [t.financing.remainingInterest, money.format(summary.remainingInterest)],
    [
      t.financing.payoff,
      summary.payoff
        ? parseApiDate(summary.payoff).toLocaleDateString(
            language === 'pt' ? 'pt-BR' : 'en-US'
          )
        : '—',
    ],
    [
      t.financing.progress,
      `${progress.toFixed(0)}% · ${summary.paidCount} / ${rows.length}`,
    ],
  ];
  return (
    <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{data.contract.name}</h1>
        <p className="text-sm text-[var(--ctp-subtext1)]">
          {[data.contract.lender, t.financing.systems[data.contract.system]]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]): JSX.Element => (
          <section key={label} className={panel}>
            <h2 className="text-sm text-[var(--ctp-subtext1)]">{label}</h2>
            <p className="text-lg font-semibold break-words">{value}</p>
          </section>
        ))}
      </div>
      <div
        role="progressbar"
        aria-label={t.financing.progress}
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--ctp-surface1)]"
      >
        <div
          className="h-full rounded-full bg-[var(--ctp-green)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <section className={panel}>
        <h2 className="mb-3 font-semibold">{t.financing.details}</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm min-[480px]:grid-cols-2 lg:grid-cols-3">
          {(
            [
              [t.financing.amount, money.format(data.contract.amount)],
              [t.financing.monthlyRate, rate(data.contract.monthlyRate ?? 0)],
              [
                t.financing.effectiveRate,
                rate(data.calculation.effectiveMonthlyRate),
              ],
              ...(
                [
                  'purchasePrice',
                  'downPayment',
                  'iof',
                  'registration',
                  'valuationFee',
                ] as const
              )
                .filter((key): boolean => Boolean(data.contract[key]))
                .map((key): [string, string] => [
                  t.financing[key],
                  money.format(data.contract[key] ?? 0),
                ]),
            ] as [string, string][]
          ).map(([label, value]): JSX.Element => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-[var(--ctp-subtext1)]">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={(): void => setAction('extra')}>
          {t.financing.extra}
        </button>
        <button className={button} onClick={(): void => setAction('sync')}>
          {t.financing.sync}
        </button>
        <button className={button} onClick={(): void => setAction('day')}>
          {t.financing.changeDay}
        </button>
      </div>
      {message && <p role="alert">{message}</p>}
      {action === 'extra' && (
        <ExtraPaymentDialog
          id={id}
          onClose={(): void => setAction(undefined)}
          onSaved={refresh}
        />
      )}
      {action && action !== 'extra' && (
        <form onSubmit={adjust} className={`${panel} flex flex-col gap-3`}>
          <h2>{actionTitle}</h2>
          {action === 'paid' && <p>{t.financing.paidHint}</p>}
          {action === 'day' ? (
            <>
              <label className="flex flex-col gap-1">
                {t.financing.fromInstallment}
                <input
                  className={field}
                  type="number"
                  min={1}
                  max={rows.length}
                  value={number}
                  onChange={(event): void =>
                    setNumber(Number(event.currentTarget.value))
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                {t.financing.dueDay}
                <input
                  className={field}
                  type="number"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(event): void =>
                    setDay(Number(event.currentTarget.value))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                {t.financing.adjustmentAmount}
                <input
                  required
                  className={field}
                  type="number"
                  min={action === 'sync' ? 0 : 0.01}
                  step="0.01"
                  value={amount}
                  onChange={(event): void =>
                    setAmount(event.currentTarget.value)
                  }
                />
              </label>
              {action === 'sync' && (
                <label className="flex flex-col gap-1">
                  {t.financing.date}
                  <input
                    required
                    className={field}
                    type="date"
                    value={date}
                    onChange={(event): void =>
                      setDate(event.currentTarget.value)
                    }
                  />
                </label>
              )}
            </>
          )}
          <button className={button} disabled={busy}>
            {t.financing.confirm}
          </button>
          <button
            className={button}
            type="button"
            onClick={(): void => setAction(undefined)}
          >
            {t.financing.cancel}
          </button>
        </form>
      )}
      <section className={`${panel} min-w-0`}>
        <h2>{t.financing.balance}</h2>
        <LineChart
          height={250}
          hideLegend
          margin={{ left: 8, right: 16 }}
          xAxis={[
            {
              data: balanceDates,
              scaleType: 'time',
              valueFormatter: (value: Date): string =>
                value.toLocaleDateString(locale, {
                  month: 'short',
                  year: '2-digit',
                }),
            },
          ]}
          yAxis={[
            {
              width: 84,
              valueFormatter: (value: number): string =>
                formatCompactBRL(value, locale),
            },
          ]}
          series={[
            {
              data: balanceValues,
              color: '#89b4fa',
              showMark: false,
            },
          ]}
        />
        <p className="text-sm text-[var(--ctp-blue)]">
          ● {t.financing.outstanding}
        </p>
      </section>
      <section className={`${panel} min-w-0`}>
        <h2>{t.financing.composition}</h2>
        <BarChart
          height={250}
          hideLegend
          margin={{ left: 8, right: 16 }}
          xAxis={[
            { data: rows.map((row): number => row.number), scaleType: 'band' },
          ]}
          yAxis={[
            {
              width: 84,
              valueFormatter: (value: number): string =>
                formatCompactBRL(value, locale),
            },
          ]}
          series={[
            {
              data: rows.map((row): number => row.principal),
              stack: 'payment',
              color: '#a6e3a1',
            },
            {
              data: rows.map((row): number => row.interest),
              stack: 'payment',
              color: '#fab387',
            },
          ]}
        />
        <div className="flex gap-4 text-sm">
          <span className="text-[var(--ctp-green)]">
            ● {t.financing.principal}
          </span>
          <span className="text-[var(--ctp-peach)]">
            ● {t.financing.interest}
          </span>
        </div>
      </section>
      <section className={`${panel} overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">{t.financing.preview}</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-[var(--ctp-subtext1)]">
            <tr>
              {[
                '#',
                t.financing.due,
                t.financing.payment,
                t.financing.principal,
                t.financing.interest,
                ...(hasInsurance ? [t.financing.insurance] : []),
                ...(hasFees ? [t.financing.fees] : []),
                t.financing.outstanding,
                t.financing.status,
              ].map((label): JSX.Element => (
                <th className="p-2 font-medium whitespace-nowrap" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row): JSX.Element => {
              const paid =
                row.paidAmount !== null && row.paidAmount !== undefined;
              return (
                <tr
                  key={row.number}
                  className={clsx(
                    'border-t border-[var(--ctp-surface1)]',
                    row.number === current && 'bg-[var(--ctp-surface1)]',
                    paid && 'text-[var(--ctp-subtext0)]'
                  )}
                >
                  <td className="p-2">{row.number}</td>
                  <td className="p-2 whitespace-nowrap">
                    {parseApiDate(row.dueDate).toLocaleDateString(locale)}
                  </td>
                  {[
                    row.paidAmount ?? row.payment,
                    row.principal,
                    row.interest,
                    ...(hasInsurance ? [row.insurance] : []),
                    ...(hasFees ? [row.fees] : []),
                    row.balance,
                  ].map((value, index): JSX.Element => (
                    <td className="p-2 whitespace-nowrap" key={index}>
                      {money.format(value)}
                    </td>
                  ))}
                  <td className="p-2 whitespace-nowrap">
                    {paid && (
                      <span className="text-[var(--ctp-green)]">
                        ✓ {t.financing.paidStatus}
                      </span>
                    )}
                    {!paid && row.number === current && (
                      <button
                        className={button}
                        onClick={(): void => {
                          setNumber(row.number);
                          setAmount(String(row.payment));
                          setAction('paid');
                        }}
                      >
                        {t.financing.recordPaid}
                      </button>
                    )}
                    {!paid && row.number !== current && (
                      <span>{t.financing.scheduled}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
