'use client';

import { Panel, TextInput, Select, Button, Field } from '@/components/ui';
import {
  AnalyticsCard,
  EmptyState,
  RankedList,
} from '@/components/Analytics/AnalyticsPanels';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import SavingEntry from '@/components/Savings/SavingEntry';
import { type InvestmentType, SavingLocation, TransactionType } from '@/enums';
import { useSavings, useTransactions } from '@/hooks';
import { useI18n } from '@/i18n/useI18n';
import { savingService } from '@/services';
import type { Saving } from '@/types';
import {
  formatBRL,
  formatCompactBRL,
  formatPercent,
  type RankedAmount,
  type AnalyticsRange,
} from '@/utils/analytics.util';
import {
  investmentAllocation,
  investmentGroups,
  investmentGroupKeys,
  emergencyRunway,
  savingsAllocation,
  savingsHistoryRange,
  savingsShare,
  selectSavings,
  type SavingsSort,
} from '@/utils/savings.util';
import { PieChart } from '@mui/x-charts';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type JSX,
} from 'react';

interface SavingForm {
  name: string;
  amount: string;
  location: SavingLocation;
  investmentType: InvestmentType | '';
}
const initialForm: SavingForm = {
  name: '',
  amount: '',
  location: SavingLocation.SAVINGS_ACCOUNT,
  investmentType: '',
};

const colors = [
  'var(--ctp-blue)',
  'var(--ctp-peach)',
  'var(--ctp-mauve)',
  'var(--ctp-teal)',
  'var(--ctp-yellow)',
];

export default function SavingsPage(): JSX.Element {
  const { language, t } = useI18n();
  const messages = t.savings;
  const request = useSavings();
  const [today] = useState((): Date => new Date());
  const range = useMemo(
    (): AnalyticsRange => savingsHistoryRange(today),
    [today]
  );
  const expenses = useTransactions(TransactionType.EXPENSE, range, {
    loadAll: true,
    pageSize: 1000,
  });
  const [form, setForm] = useState<SavingForm>(initialForm);
  const [editing, setEditing] = useState<Saving>();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SavingsSort>('amount');
  const [location, setLocation] = useState<SavingLocation | null>(null);
  const [investmentType, setInvestmentType] = useState<InvestmentType | null>(
    null
  );
  const investments = investmentAllocation(request.data ?? []);
  const nameInput = useRef<HTMLInputElement>(null);
  const allocation = savingsAllocation(request.data ?? []);
  const entries = selectSavings(
    request.data ?? [],
    search,
    location,
    sort,
    language,
    investmentType
  );
  const runway = emergencyRunway(allocation.total, expenses.data ?? [], today);
  const expensesLoading =
    expenses.isLoading || expenses.isLoadingMore || expenses.hasMore;
  const largest = allocation.locations.find((item): boolean => item.amount > 0);
  const nameInvalid = !form.name.trim();
  const amountInvalid =
    !form.amount.trim() ||
    !Number.isFinite(Number(form.amount)) ||
    Number(form.amount) < 0;
  const typeInvalid =
    form.location === SavingLocation.INVESTMENT && !form.investmentType;
  function reset(): void {
    setEditing(undefined);
    setForm(initialForm);
    setSubmitted(false);
    setError('');
  }
  useEffect(() => {
    function escape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setEditing(undefined);
        setForm(initialForm);
        setSubmitted(false);
      }
    }
    window.addEventListener('keydown', escape);
    return (): void => window.removeEventListener('keydown', escape);
  }, []);
  function edit(saving: Saving): void {
    setEditing(saving);
    setForm({
      name: saving.name,
      amount: String(saving.amount),
      location: saving.location,
      investmentType: saving.investmentType ?? '',
    });
    setSubmitted(false);
    setError('');
    nameInput.current?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitted(true);
    if (nameInvalid || amountInvalid || typeInvalid) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        amount: Number(form.amount),
        location: form.location,
        ...(form.location === SavingLocation.INVESTMENT && form.investmentType
          ? { investmentType: form.investmentType }
          : {}),
      };
      if (editing) {
        await savingService.updateSaving({ ...payload, id: editing.id });
      } else {
        await savingService.createSaving(payload);
      }
      reset();
      await refreshMoneyFlow();
      await request.mutate();
    } catch {
      setError(messages.saveError);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string): Promise<void> {
    try {
      await savingService.deleteSaving(id);
      if (editing?.id === id) {
        reset();
      }
      await refreshMoneyFlow();
      await request.mutate();
    } catch {
      setError(messages.deleteError);
    }
  }
  let runwayText = messages.noRunway;
  if (runway !== null) {
    runwayText = `${new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(runway)} ${messages.months}`;
  }
  if (expensesLoading) {
    runwayText = messages.loading;
  }
  if (expenses.error) {
    runwayText = messages.expensesError;
  }
  return (
    <main className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-6 p-4 text-[var(--ctp-text)] md:p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {messages.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--ctp-subtext1)]">
          {messages.subtitle}
        </p>
      </header>
      {error && (
        <p role="alert" className="text-sm text-[var(--ctp-red)]">
          {error}
        </p>
      )}
      {request.error && <p role="alert">{messages.loadError}</p>}
      {request.isLoading ? (
        <div
          role="status"
          aria-label={messages.loading}
          className="grid animate-pulse gap-4 sm:grid-cols-2"
        >
          <span className="sr-only">{messages.loading}</span>
          {[0, 1, 2, 3].map((index): JSX.Element => (
            <Panel key={index} className="h-40" />
          ))}
        </div>
      ) : (
        !request.error && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AnalyticsCard title={messages.totalSaved}>
                <p className="text-3xl font-semibold break-all">
                  {formatBRL(allocation.total, language)}
                </p>
                <p className="mt-2 text-sm text-[var(--ctp-subtext1)]">
                  {new Intl.NumberFormat(language).format(
                    request.data?.length ?? 0
                  )}{' '}
                  {messages.entries}
                </p>
              </AnalyticsCard>
              <AnalyticsCard title={messages.runway}>
                <p className="text-xl font-semibold">{runwayText}</p>
                <p className="mt-2 text-xs text-[var(--ctp-subtext1)]">
                  {messages.runwayNote}
                </p>
              </AnalyticsCard>
              <AnalyticsCard title={messages.liquidity}>
                <dl className="space-y-2 text-sm">
                  {[
                    { label: messages.liquid, amount: allocation.liquid },
                    { label: messages.invested, amount: allocation.invested },
                    { label: messages.other, amount: allocation.other },
                  ].map((item): JSX.Element => (
                    <div key={item.label}>
                      <dt className="text-[var(--ctp-subtext1)]">
                        {item.label}
                      </dt>
                      <dd className="font-medium break-words">
                        {formatBRL(item.amount, language)} ·{' '}
                        {formatPercent(
                          savingsShare(item.amount, allocation.total),
                          language
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </AnalyticsCard>
              <AnalyticsCard title={messages.largest}>
                {largest ? (
                  <>
                    <p className="text-xl font-semibold">
                      {messages.locations[largest.location]}
                    </p>
                    <p className="mt-2 break-all">
                      {formatBRL(largest.amount, language)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ctp-subtext1)]">
                      {formatPercent(largest.share, language)}
                    </p>
                  </>
                ) : (
                  <EmptyState message={messages.empty} />
                )}
              </AnalyticsCard>
            </section>
            {request.data?.some(
              (saving): boolean => saving.location === SavingLocation.INVESTMENT
            ) && (
              <AnalyticsCard title={messages.investments}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {investments.groups.map((item): JSX.Element => (
                    <div key={item.group} className="text-sm">
                      <p>{messages.investmentGroups[item.group]}</p>
                      <p>
                        {formatBRL(item.amount, language)} ·{' '}
                        {formatPercent(item.share, language)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid min-w-0 items-center gap-6 md:grid-cols-2">
                  <div
                    role="img"
                    aria-label={messages.investments}
                    className="min-w-0"
                  >
                    {investments.total > 0 && (
                      <PieChart
                        height={260}
                        hideLegend
                        series={[
                          {
                            innerRadius: 65,
                            outerRadius: 100,
                            paddingAngle: 3,
                            data: investments.groups
                              .filter((item): boolean => item.amount > 0)
                              .map(
                                (
                                  item,
                                  index
                                ): {
                                  id: string;
                                  label: string;
                                  value: number;
                                  color: string;
                                } => ({
                                  id: item.group,
                                  label: messages.investmentGroups[item.group],
                                  value: item.amount,
                                  color: colors[index],
                                })
                              ),
                            valueFormatter: (item): string =>
                              formatCompactBRL(item.value, language),
                          },
                        ]}
                      />
                    )}
                  </div>
                  <RankedList
                    items={investments.types
                      .filter((item): boolean => item.amount > 0)
                      .map((item): RankedAmount => ({
                        ...item,
                        label: messages.investmentTypes[item.type],
                      }))}
                  />
                </div>
              </AnalyticsCard>
            )}
            <AnalyticsCard title={messages.allocation}>
              {allocation.total > 0 ? (
                <div className="grid min-w-0 items-center gap-6 md:grid-cols-2">
                  <div
                    className="min-w-0"
                    role="img"
                    aria-label={messages.allocation}
                  >
                    <PieChart
                      height={260}
                      hideLegend
                      series={[
                        {
                          innerRadius: 65,
                          outerRadius: 100,
                          paddingAngle: 3,
                          data: allocation.locations
                            .filter((item): boolean => item.amount > 0)
                            .map(
                              (
                                item,
                                index
                              ): {
                                id: SavingLocation;
                                label: string;
                                value: number;
                                color: string;
                              } => ({
                                id: item.location,
                                label: messages.locations[item.location],
                                value: item.amount,
                                color: colors[index],
                              })
                            ),
                          valueFormatter: (item): string =>
                            formatCompactBRL(item.value, language),
                        },
                      ]}
                    />
                  </div>
                  <RankedList
                    items={allocation.locations
                      .filter((item): boolean => item.amount > 0)
                      .map((item): RankedAmount => ({
                        ...item,
                        label: messages.locations[item.location],
                      }))}
                  />
                </div>
              ) : (
                <EmptyState message={messages.empty} />
              )}
            </AnalyticsCard>
          </>
        )
      )}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AnalyticsCard title={messages.entries}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={messages.search}>
              <TextInput
                className="mt-1"
                value={search}
                onChange={(event): void => setSearch(event.target.value)}
              />
            </Field>
            <Field label={messages.sort}>
              <Select
                className="mt-1"
                value={sort}
                onChange={(event): void =>
                  setSort(event.target.value as SavingsSort)
                }
              >
                <option value="amount">{messages.sortAmount}</option>
                <option value="name">{messages.sortName}</option>
                <option value="updated">{messages.sortUpdated}</option>
              </Select>
            </Field>
          </div>
          <div
            className="my-4 flex flex-wrap gap-2"
            role="group"
            aria-label={messages.location}
          >
            {[null, ...Object.values(SavingLocation)].map(
              (value): JSX.Element => (
                <Button
                  variant={investmentType === value ? 'primary' : 'secondary'}
                  key={value ?? 'all'}
                  type="button"
                  aria-pressed={location === value}
                  onClick={(): void => {
                    setLocation(value);
                    setInvestmentType(null);
                  }}
                >
                  {value === null ? messages.all : messages.locations[value]}
                </Button>
              )
            )}
          </div>
          {location === SavingLocation.INVESTMENT && (
            <div
              role="group"
              aria-label={messages.investmentType}
              className="mb-4 flex flex-wrap gap-2"
            >
              {[
                null,
                ...investments.types
                  .filter((item): boolean => item.amount > 0)
                  .map((item): InvestmentType => item.type),
              ].map((value): JSX.Element => (
                <Button
                  variant={investmentType === value ? 'primary' : 'secondary'}
                  key={value ?? 'all'}
                  type="button"
                  aria-pressed={investmentType === value}
                  onClick={(): void => setInvestmentType(value)}
                >
                  {value === null
                    ? messages.allInvestmentTypes
                    : messages.investmentTypes[value]}
                </Button>
              ))}
            </div>
          )}
          {!request.isLoading && !request.error && (
            <>
              {entries.length ? (
                <ul className="space-y-3">
                  {entries.map((saving): JSX.Element => (
                    <SavingEntry
                      key={saving.id}
                      saving={saving}
                      total={allocation.total}
                      today={today}
                      onEdit={edit}
                      onDelete={remove}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  message={
                    request.data?.length ? messages.noMatches : messages.empty
                  }
                />
              )}
            </>
          )}
        </AnalyticsCard>
        <AnalyticsCard title={editing ? messages.editTitle : messages.addTitle}>
          <form noValidate onSubmit={submit} className="space-y-4">
            <Field label={t.common.name}>
              <TextInput
                ref={nameInput}
                id="saving-name"
                className="mt-1"
                value={form.name}
                aria-invalid={submitted && nameInvalid}
                aria-describedby={
                  submitted && nameInvalid ? 'name-error' : undefined
                }
                onChange={(event): void =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </Field>
            {submitted && nameInvalid && (
              <p id="name-error" className="text-xs text-[var(--ctp-red)]">
                {messages.nameRequired}
              </p>
            )}
            <Field label={<>{messages.amount} (BRL)</>}>
              <TextInput
                id="saving-amount"
                type="number"
                min="0"
                step="0.01"
                className="mt-1"
                value={form.amount}
                aria-invalid={submitted && amountInvalid}
                aria-describedby={
                  submitted && amountInvalid ? 'amount-error' : undefined
                }
                onChange={(event): void =>
                  setForm({ ...form, amount: event.target.value })
                }
              />
            </Field>
            {submitted && amountInvalid && (
              <p id="amount-error" className="text-xs text-[var(--ctp-red)]">
                {messages.amountInvalid}
              </p>
            )}
            <Field label={messages.location}>
              <Select
                id="saving-location"
                className="mt-1"
                value={form.location}
                onChange={(event): void =>
                  setForm({
                    ...form,
                    location: event.target.value as SavingLocation,
                  })
                }
              >
                {Object.values(SavingLocation).map((value): JSX.Element => (
                  <option key={value} value={value}>
                    {messages.locations[value]}
                  </option>
                ))}
              </Select>
            </Field>
            {form.location === SavingLocation.INVESTMENT && (
              <>
                <Field label={messages.investmentType}>
                  <Select
                    id="saving-investment-type"
                    required
                    className="mt-1"
                    value={form.investmentType}
                    aria-invalid={submitted && typeInvalid}
                    aria-describedby={
                      submitted && typeInvalid ? 'type-error' : undefined
                    }
                    onChange={(event): void =>
                      setForm({
                        ...form,
                        investmentType: event.target.value as
                          InvestmentType | '',
                      })
                    }
                  >
                    <option value="">{messages.selectInvestmentType}</option>
                    {investmentGroupKeys.map((group): JSX.Element => (
                      <optgroup
                        key={group}
                        label={messages.investmentGroups[group]}
                      >
                        {investmentGroups[group].map((type): JSX.Element => (
                          <option key={type} value={type}>
                            {messages.investmentTypes[type]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                {submitted && typeInvalid && (
                  <span
                    id="type-error"
                    className="text-xs text-[var(--ctp-red)]"
                  >
                    {messages.investmentTypeRequired}
                  </span>
                )}
              </>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? t.common.saving : t.common.save}
              </Button>
              {editing && (
                <Button
                  variant="secondary"
                  type="button"
                  disabled={busy}
                  onClick={reset}
                >
                  {messages.cancel}
                </Button>
              )}
            </div>
          </form>
        </AnalyticsCard>
      </div>
    </main>
  );
}
