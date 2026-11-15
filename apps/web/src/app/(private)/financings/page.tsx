'use client';
import Link from 'next/link';
import useSWR from 'swr';
import type { JSX } from 'react';
import type { Financing } from '@budget-manager/api-client';
import { getFetcher } from '@/libs/fetchers.lib';
import { useI18n } from '@/i18n/useI18n';
import { button, panel } from '@/components/Financing/styles';
import { parseApiDate } from '@/utils/globalFormats.util';
import { financingSummary } from '@/utils/financing.util';
export default function FinancingsPage(): JSX.Element {
  const { t, language } = useI18n();
  const { data, error } = useSWR('/financings', getFetcher<Financing[]>);
  const money = new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
  });
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t.financing.title}</h1>
      <Link className={button} href="/financings/new">
        {t.financing.newContract}
      </Link>
      {error && <p role="alert">{t.financing.error}</p>}
      {!data && !error && <p>{t.financing.loading}</p>}
      {data?.length === 0 && <p>{t.financing.empty}</p>}
      {data?.map((financing): JSX.Element => {
        const summary = financingSummary(
          financing.calculation.schedule,
          financing.extraPaid,
          financing.payoffDate
        );
        return (
          <Link
            className={panel}
            key={financing.id}
            href={`/financings/${financing.id}`}
          >
            <h2 className="font-semibold">{financing.contract.name}</h2>
            <p>
              {t.financing.outstanding}: {money.format(summary.outstanding)}
            </p>
            <p>
              {t.financing.payoff}:{' '}
              {summary.payoff &&
                parseApiDate(summary.payoff).toLocaleDateString(
                  language === 'pt' ? 'pt-BR' : 'en-US'
                )}
            </p>
            <p>
              {t.financing.payment}:{' '}
              {money.format(
                financing.calculation.schedule.find(
                  (row): boolean =>
                    row.paidAmount === null || row.paidAmount === undefined
                )?.payment ?? 0
              )}
            </p>
          </Link>
        );
      })}
    </main>
  );
}
