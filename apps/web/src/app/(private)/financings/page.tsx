'use client';
import { Page } from '@/components/ui';
import Link from 'next/link';
import useSWR from 'swr';
import type { JSX } from 'react';
import type { Financing } from '@budget-manager/api-client';
import { getFetcher } from '@/libs/fetchers.lib';
import { useI18n } from '@/i18n/useI18n';
import { buttonClassName, panelStyle } from '@/components/ui/styles';
import { getLocation, parseApiDate } from '@/utils/globalFormats.util';
import { financingSummary } from '@/utils/financing.util';
export default function FinancingsPage(): JSX.Element {
  const { t, language } = useI18n();
  const { data, error } = useSWR('/financings', getFetcher<Financing[]>);
  const money = new Intl.NumberFormat(getLocation(language), {
    style: 'currency',
    currency: 'BRL',
  });
  return (
    <Page>
      <h1 className="text-xl font-semibold">{t.financing.title}</h1>
      <Link
        className={`${buttonClassName()} w-full sm:w-1/2`}
        href="/financings/new"
      >
        {t.financing.newContract}
      </Link>
      {error && <p role="alert">{t.financing.error}</p>}
      {!data && !error && <p>{t.financing.loading}</p>}
      {data?.length === 0 && <p>{t.financing.empty}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((financing): JSX.Element => {
          const summary = financingSummary(
            financing.calculation.schedule,
            financing.extraPaid,
            financing.payoffDate
          );
          return (
            <Link
              className={panelStyle}
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
                    getLocation(language)
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
      </div>
    </Page>
  );
}
