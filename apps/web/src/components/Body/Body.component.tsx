'use client';
import CardLimit from '@/components/Bank/CardLimit';

import { MonthSwitcher, Panel, Button } from '@/components/ui';

import { useMemo, useState, type JSX } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import type {
  MonthOverview,
  Movement,
  MovementDraft,
  Evolution as EvolutionPoint,
  Financing,
} from '@budget-manager/api-client';
import { NewTransaction } from '@/components';
import MovementForm from '@/components/MoneyFlow/MovementForm';
import BalanceAdjust from '@/components/MoneyFlow/BalanceAdjust';
import MonthSummary from '@/components/Home/MonthSummary';
import Evolution from '@/components/Home/Evolution';
import Drawer from '@/components/Home/Drawer';
import EntryList from '@/components/Home/EntryList';
import {
  accountOutflows,
  transactionEntry,
  type Entry,
} from '@/components/Home/model';

import { TransactionType } from '@/enums';
import { useTransactions } from '@/hooks';
import useCurrentUser from '@/hooks/useCurrentUser.hook';
import useCards from '@/hooks/useCards.hook';
import useSavings from '@/hooks/useSavings.hook';
import { useI18n } from '@/i18n/useI18n';
import { getFetcher } from '@/libs/fetchers.lib';
import {
  type DateRangeTransactions,
  getStartOfTheMonthAndEndOfTheMonth,
  getApiDate,
  parseApiDate,
  formatDate,
  getLocation,
} from '@/utils/globalFormats.util';
import NextGoal from '@/components/Goals/NextGoal';
import SurplusDialog from '@/components/Goals/SurplusDialog';
import { monthKey } from '@/utils/monthlyTransaction.util';
import { bankColors } from '@/utils/payment.util';
import { formatBRL } from '@/utils/analytics.util';
export default function Body(): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.dashboard;
  const [date, setDate] = useState(new Date());
  const [unassigned, setUnassigned] = useState(false);
  const [drawer, setDrawer] = useState<'entry' | 'movement'>();
  const [draft, setDraft] = useState<Partial<MovementDraft>>({});
  const [surplusDraft, setSurplusDraft] =
    useState<Partial<MovementDraft> | null>(null);
  const [adjust, setAdjust] = useState<string>();
  const range = useMemo(
    (): DateRangeTransactions => getStartOfTheMonthAndEndOfTheMonth(date),
    [date]
  );
  const incomes = useTransactions(TransactionType.INCOME, range, {
    loadAll: true,
    pageSize: 1000,
  });
  const expenses = useTransactions(TransactionType.EXPENSE, range, {
    loadAll: true,
    pageSize: 1000,
  });
  const overview = useSWR(
    `/overview/${monthKey(date)}`,
    getFetcher<MonthOverview>
  );
  const evolution = useSWR('/overview/evolution', getFetcher<EvolutionPoint[]>);
  const movements = useSWR(
    `/movements?${new URLSearchParams({ startDate: getApiDate(range.startDate), endDate: getApiDate(range.endDate) })}`,
    getFetcher<Movement[]>
  );
  const financings = useSWR('/financings', getFetcher<Financing[]>);
  const { data: user } = useCurrentUser();
  const { data: cards } = useCards();
  const { data: savings } = useSavings();
  const names: Record<string, string> = Object.fromEntries(
    [
      ...(overview.data?.accounts ?? []),
      ...(cards ?? []),
      ...(savings ?? []),
    ].map((item): [string, string] => [item.id, item.name])
  );
  const incomeEntries = (incomes.data ?? []).map((transaction): Entry =>
    transactionEntry(transaction, 'income', date, t.payments.methods)
  );
  const entries: Entry[] = [
    ...incomeEntries,
    ...(expenses.data ?? []).map((transaction): Entry =>
      transactionEntry(transaction, 'expenses', date, t.payments.methods)
    ),
    ...(movements.data ?? [])
      .filter((movement): boolean => !movement.opening)
      .map((movement, index): Entry => ({
        key: movement.id ?? `automatic-${index}`,
        type: 'movements',
        amount: movement.amount,
        date: parseApiDate(movement.date).getTime(),
        search: [
          t.moneyFlow[movement.kind],
          movement.notes,
          ...[
            movement.fromAccountId,
            movement.toAccountId,
            movement.cardId,
            movement.savingId,
          ].map((id): string => names[id ?? ''] ?? ''),
        ].join(' '),
        description: movement.notes || t.moneyFlow[movement.kind],
        category: `${names[movement.fromAccountId ?? ''] ?? '—'} → ${names[movement.toAccountId ?? movement.savingId ?? movement.cardId ?? ''] ?? '—'}`,
        payment: [
          movement.fromAccountId,
          movement.toAccountId,
          movement.cardId,
        ].flatMap((id): string[] => (id && names[id] ? [names[id]] : [])),
        unassigned: false,
        movement,
      })),
  ];
  function openMovement(value: Partial<MovementDraft>): void {
    setDraft(value);
    setDrawer('movement');
  }
  const loading =
    incomes.isLoadingMore ||
    incomes.hasMore ||
    expenses.isLoadingMore ||
    expenses.hasMore ||
    !movements.data;
  const error =
    overview.error ||
    evolution.error ||
    movements.error ||
    incomes.error ||
    expenses.error ||
    financings.error;
  return (
    <main className="flex min-w-0 flex-col gap-4 p-3 text-[var(--ctp-text)] sm:p-5">
      {surplusDraft && (
        <SurplusDialog
          draft={surplusDraft}
          onClose={(): void => setSurplusDraft(null)}
        />
      )}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <MonthSwitcher value={date} onChange={setDate} />
      </header>
      {error && <p role="alert">{t.common.errorGeneric}</p>}
      {!overview.data && !overview.error && (
        <p role="status">{labels.loading}</p>
      )}
      {overview.data && (
        <>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <MonthSummary
              overview={overview.data}
              incomes={incomeEntries}
              month={date}
              salaryDay={user?.salaryDay}
              mainAccountId={user?.mainAccountId}
              onInvest={setSurplusDraft}
              outflows={accountOutflows(entries)}
              ready={!loading}
            />
            <NextGoal />
          </div>
          <Panel
            className="flex w-full flex-col gap-3"
            aria-labelledby="accounts"
          >
            <h2 id="accounts" className="text-xl font-semibold">
              {labels.accounts}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {overview.data.accounts.map((account): JSX.Element => (
                <Panel
                  as="li"
                  key={account.id}
                  className="flex min-w-0 flex-col gap-1"
                >
                  <strong>{account.name}</strong>
                  <span>{formatBRL(account.balanceToday, language)}</span>
                  {account.balanceCheckpointDate && (
                    <small>
                      {labels.updated}{' '}
                      {parseApiDate(
                        account.balanceCheckpointDate
                      ).toLocaleDateString(getLocation(language), {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </small>
                  )}
                  <Button
                    className="text-left"
                    variant="ghost"
                    onClick={(): void => setAdjust(account.id)}
                  >
                    {t.moneyFlow.adjust}
                  </Button>
                </Panel>
              ))}
            </ul>
            <p>
              {labels.available}:{' '}
              {formatBRL(
                overview.data.accounts.reduce(
                  (sum, account): number => sum + account.balanceToday,
                  0
                ),
                language
              )}
            </p>
            {overview.data.unassigned.count > 0 && (
              <a
                href="#entries"
                className="text-sm text-[var(--ctp-subtext0)] underline"
                onClick={(): void => setUnassigned(true)}
              >
                {labels.unassigned(overview.data.unassigned.count)}
              </a>
            )}
          </Panel>
          <Panel className="flex w-full flex-col gap-3" aria-labelledby="bills">
            <h2 id="bills" className="text-xl font-semibold">
              {labels.bills}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {overview.data.bills.map((bill): JSX.Element => (
                <Panel
                  className="flex w-full flex-col gap-3"
                  as="li"
                  key={`${bill.cardId}-${bill.dueDate}`}
                >
                  <strong>
                    <span
                      aria-hidden="true"
                      style={{
                        color:
                          bankColors[
                            cards?.find(
                              (card): boolean => card.id === bill.cardId
                            )?.bank ?? 'OTHER'
                          ] ?? 'var(--ctp-blue)',
                      }}
                    >
                      ●{' '}
                    </span>
                    {bill.card}
                  </strong>
                  <p>
                    {formatDate(parseApiDate(bill.dueDate), language)} ·{' '}
                    {formatBRL(bill.total, language)}
                  </p>
                  <CardLimit
                    creditLimit={bill.creditLimit}
                    availableLimit={bill.availableLimit}
                  />
                  {bill.paymentAccount && (
                    <p>
                      {labels.paidFrom} {bill.paymentAccount.name}
                    </p>
                  )}
                  <small>
                    {bill.automatic
                      ? t.moneyFlow.automatic
                      : t.moneyFlow.recorded}{' '}
                    · {bill.paid ? labels.paid : labels.due}
                  </small>
                </Panel>
              ))}
              {financings.data?.flatMap((financing): JSX.Element[] =>
                financing.calculation.schedule
                  .filter(
                    (row): boolean =>
                      monthKey(parseApiDate(row.dueDate)) === monthKey(date)
                  )
                  .map((row): JSX.Element => (
                    <li key={`${financing.id}-${row.number}`}>
                      <Link
                        className="underline"
                        href={`/financings/${financing.id}`}
                      >
                        {financing.contract.name} · {row.number}
                      </Link>
                      <p>
                        {formatDate(parseApiDate(row.dueDate), language)} ·{' '}
                        {formatBRL(row.payment, language)} ·{' '}
                        {row.status === 'PAID' ? labels.paid : labels.due}
                      </p>
                    </li>
                  ))
              )}
            </ul>
          </Panel>
        </>
      )}
      {evolution.data && <Evolution rows={evolution.data} />}
      <EntryList
        key={monthKey(date)}
        entries={entries}
        month={date}
        names={names}
        unassigned={unassigned}
        onUnassigned={setUnassigned}
        onRecord={openMovement}
        loading={loading}
      />
      {adjust && (
        <Drawer
          title={t.moneyFlow.adjust}
          onClose={(): void => setAdjust(undefined)}
        >
          <BalanceAdjust
            accountId={adjust}
            onClose={(): void => setAdjust(undefined)}
          />
        </Drawer>
      )}
      {drawer && (
        <Drawer
          title={drawer === 'movement' ? t.moneyFlow.title : labels.entries}
          onClose={(): void => setDrawer(undefined)}
        >
          {drawer === 'entry' ? (
            <NewTransaction
              selectedDate={date}
              onClose={(): void => setDrawer(undefined)}
            />
          ) : (
            <MovementForm
              variant="drawer"
              initialKind={draft.kind}
              initialDraft={draft}
              onClose={(): void => setDrawer(undefined)}
            />
          )}
        </Drawer>
      )}
    </main>
  );
}
