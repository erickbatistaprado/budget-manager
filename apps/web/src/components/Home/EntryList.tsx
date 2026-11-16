'use client';

import clsx from 'clsx';
import {
  columnDivider,
  Panel,
  Checkbox,
  TextInput,
  Button,
  Select,
  Field,
  IconButton,
  DateField,
  parseFieldDate,
  formatFieldDate,
} from '@/components/ui';
import { BiChevronUp, BiChevronDown, BiSearch, BiFilter } from 'react-icons/bi';
import { useEffect, useState, useRef, useId, type JSX } from 'react';
import type { MovementDraft } from '@budget-manager/api-client';
import { FinancialMovements } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import { formatBRL } from '@/utils/analytics.util';
import { getLocation } from '@/utils/globalFormats.util';

import {
  filterEntries,
  filteredTotals,
  type Entry,
  type Filters,
} from './model';
import MovementRow from './MovementRow';
import { useCurrentUser } from '@/hooks';
const initialFilters: Filters = {
  search: '',
  type: 'all',
  category: '',
  payment: '',
  unassigned: false,
  sort: 'date',
  direction: 'desc',
  minimum: '',
  maximum: '',
  from: '',
  until: '',
};

export default function EntryList({
  entries,
  month,
  names,
  unassigned,
  onUnassigned,
  onRecord,
  loading,
}: {
  entries: Entry[];
  month: Date;
  names: Record<string, string>;
  unassigned: boolean;
  onUnassigned: (value: boolean) => void;
  onRecord: (draft: Partial<MovementDraft>) => void;
  loading: boolean;
}): JSX.Element {
  const { t, language } = useI18n();
  const labels = t.dashboard;
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  function close(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }
  useEffect((): (() => void) | undefined => {
    if (!open) return;
    popoverRef.current
      ?.querySelector<HTMLElement>('button, input, select')
      ?.focus();
    function outside(event: PointerEvent): void {
      if (
        event.target instanceof Node &&
        !fieldRef.current?.contains(event.target)
      )
        close();
    }
    function escape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return (): void => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinel = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const { data: viewer } = useCurrentUser();
  const storageKey = viewer ? `budget-entry-filters:${viewer.id}` : null;
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const [previousMonth, setPreviousMonth] = useState(monthKey);
  if (previousMonth !== monthKey) {
    setPreviousMonth(monthKey);
    setFilters((previous): Filters => ({ ...previous, from: '', until: '' }));
    setVisibleCount(30);
  }
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Synchronize the controls with the viewer’s external storage.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect((): void => {
    if (!storageKey) return;
    const restored = { ...initialFilters };
    let restoredUnassigned = false;
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? 'null'
      );
      if (saved && typeof saved === 'object') {
        for (const key of Object.keys(initialFilters) as (keyof Filters)[]) {
          const candidate = Reflect.get(saved, key);
          if (typeof candidate === 'string' && key !== 'unassigned')
            Object.assign(restored, { [key]: candidate });
        }
        if (Reflect.get(saved, 'monthKey') !== monthKey) {
          restored.from = '';
          restored.until = '';
        }
        if (
          !['date', 'amount', 'description', 'category'].includes(
            restored.sort ?? ''
          )
        )
          restored.sort = 'date';
        if (!['asc', 'desc'].includes(restored.direction ?? ''))
          restored.direction = 'desc';
        restoredUnassigned = Reflect.get(saved, 'unassigned') === true;
      }
    } catch {
      /* Storage is optional. */
    }
    setFilters(restored);
    onUnassigned(restoredUnassigned);
    setLoadedKey(storageKey);
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect((): void => {
    if (!storageKey || loadedKey !== storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...filters, unassigned, monthKey })
      );
    } catch {
      /* Storage is optional. */
    }
  }, [filters, storageKey, loadedKey, unassigned, monthKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const amountLabels = {
    minimum: labels.minimumValue,
    maximum: labels.maximumValue,
  };
  const dayLabels = { from: labels.from, until: labels.until };
  const filterLabel = labels.filters;
  const clearLabel = labels.clearFilters;
  const chips: { key: keyof Filters; label: string }[] = [];
  if (filters.type !== 'all')
    chips.push({
      key: 'type',
      label: labels[filters.type as 'income' | 'expenses' | 'movements'],
    });
  if (filters.category)
    chips.push({
      key: 'category',
      label: `${labels.category}: ${filters.category}`,
    });
  if (filters.payment)
    chips.push({
      key: 'payment',
      label: `${labels.payment}: ${filters.payment}`,
    });
  if (filters.minimum)
    chips.push({
      key: 'minimum',
      label: `${labels.value} ≥ ${formatBRL(Number(filters.minimum), language)}`,
    });
  if (filters.maximum)
    chips.push({
      key: 'maximum',
      label: `${labels.value} ≤ ${formatBRL(Number(filters.maximum), language)}`,
    });
  for (const key of ['from', 'until'] as const) {
    if (filters[key])
      chips.push({
        key,
        label: `${dayLabels[key]}: ${parseFieldDate(filters[key])?.toLocaleDateString(getLocation(language))}`,
      });
  }
  if (unassigned) chips.push({ key: 'unassigned', label: labels.noAccount });
  function clear(): void {
    setFilters({
      ...initialFilters,
      sort: filters.sort,
      direction: filters.direction,
    });
    onUnassigned(false);
    setVisibleCount(30);
  }
  const columns = [
    { key: 'description', label: labels.description },
    { key: 'category', label: labels.category },
    { key: 'date', label: labels.date },
    { key: 'amount', label: labels.value },
  ] as const;
  function sortState(
    key: NonNullable<Filters['sort']>
  ): 'none' | 'ascending' | 'descending' {
    if (filters.sort !== key) return 'none';
    return filters.direction === 'asc' ? 'ascending' : 'descending';
  }
  function sortButton(column: (typeof columns)[number]): JSX.Element {
    return (
      <Button
        variant="ghost"
        className={column.key === 'amount' ? 'ml-auto' : ''}
        aria-label={t.common.sortBy(column.label)}
        onClick={(): void => sort(column.key)}
      >
        {column.label}
        {filters.sort === column.key && (
          <span aria-label={t.common.sorted(filters.direction ?? 'desc')}>
            {filters.direction === 'asc' ? <BiChevronUp /> : <BiChevronDown />}
          </span>
        )}
      </Button>
    );
  }
  function sort(key: NonNullable<Filters['sort']>): void {
    let direction: 'asc' | 'desc' =
      key === 'date' || key === 'amount' ? 'desc' : 'asc';
    if (filters.sort === key)
      direction = filters.direction === 'asc' ? 'desc' : 'asc';
    setFilters({ ...filters, sort: key, direction });
    setVisibleCount(30);
  }

  const filtered = filterEntries(entries, { ...filters, unassigned });
  const totals = filteredTotals(filtered);
  const resetKey = JSON.stringify([monthKey, filters, unassigned]);
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  if (previousResetKey !== resetKey) {
    setPreviousResetKey(resetKey);
    setVisibleCount(30);
  }
  const hasMore = visibleCount < filtered.length;
  useEffect((): (() => void) | undefined => {
    if (
      !hasMore ||
      !sentinel.current ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    const observer = new IntersectionObserver((observations): void => {
      if (
        observations.some((observation): boolean => observation.isIntersecting)
      ) {
        setVisibleCount((count): number => count + 30);
      }
    });
    observer.observe(sentinel.current);
    return (): void => observer.disconnect();
  }, [hasMore, visibleCount, resetKey]);
  function change(key: keyof Filters, value: string): void {
    setFilters({ ...filters, [key]: value });
    setVisibleCount(30);
  }
  return (
    <Panel
      className="flex w-full flex-col gap-3"
      id="entries"
      aria-labelledby="entries-heading"
    >
      <h2 id="entries-heading" className="text-xl font-semibold">
        {labels.entries}
      </h2>
      <div ref={fieldRef} className="relative">
        <TextInput
          startAdornment={<BiSearch aria-hidden="true" />}
          endAdornment={
            <IconButton
              ref={triggerRef}
              aria-label={filterLabel}
              aria-expanded={open}
              aria-controls={popoverId}
              onClick={(): void => {
                if (open) close();
                else setOpen(true);
              }}
            >
              <BiFilter aria-hidden="true" />
              {chips.length > 0 && (
                <span
                  className="ml-1 rounded-full bg-[var(--ctp-surface1)] px-1 text-xs"
                  aria-label={`${chips.length}`}
                >
                  {chips.length}
                </span>
              )}
            </IconButton>
          }
          type="search"
          size="small"
          aria-label={labels.search}
          placeholder={labels.search}
          value={filters.search}
          onChange={(event): void =>
            change('search', event.currentTarget.value)
          }
        />
        {open && (
          <div
            id={popoverId}
            ref={popoverRef}
            role="dialog"
            aria-label={filterLabel}
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col gap-5 overflow-y-auto rounded-t-xl border border-[var(--ctp-surface1)] bg-[var(--ctp-base)] p-5 shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-[min(36rem,90vw)] sm:rounded-xl"
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {(['all', 'income', 'expenses', 'movements'] as const).map(
                  (type): JSX.Element => (
                    <Button
                      variant="secondary"
                      key={type}
                      selected={filters.type === type}
                      aria-pressed={filters.type === type}
                      onClick={(): void => change('type', type)}
                    >
                      {labels[type]}
                    </Button>
                  )
                )}
              </div>
              <Checkbox
                label={labels.noAccount}
                checked={unassigned}
                onChange={(event): void => {
                  onUnassigned(event.currentTarget.checked);
                  setVisibleCount(30);
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['category', 'payment'] as const).map((key): JSX.Element => (
                <Field label={labels[key]} key={key}>
                  <Select
                    size="small"
                    value={filters[key]}
                    onChange={(event): void =>
                      change(key, event.currentTarget.value)
                    }
                  >
                    <option value="">{labels.all}</option>
                    {[
                      ...new Set(
                        entries.flatMap((entry): string[] =>
                          key === 'category' ? [entry.category] : entry.payment
                        )
                      ),
                    ]
                      .filter(Boolean)
                      .sort()
                      .map((value): JSX.Element => (
                        <option key={value}>{value}</option>
                      ))}
                  </Select>
                </Field>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['minimum', 'maximum'] as const).map((key): JSX.Element => (
                <TextInput
                  key={key}
                  size="small"
                  type="number"
                  min="0"
                  step="0.01"
                  label={amountLabels[key]}
                  value={filters[key]}
                  onChange={(event): void => change(key, event.target.value)}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['from', 'until'] as const).map((key): JSX.Element => (
                <DateField
                  key={key}
                  size="small"
                  label={dayLabels[key]}
                  value={parseFieldDate(filters[key] ?? '')}
                  min={new Date(month.getFullYear(), month.getMonth(), 1)}
                  max={new Date(month.getFullYear(), month.getMonth() + 1, 0)}
                  onChange={(date): void => change(key, formatFieldDate(date))}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--ctp-surface1)] pt-4">
              <Button variant="ghost" onClick={clear}>
                {clearLabel}
              </Button>
              <Button onClick={close}>{labels.done}</Button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip): JSX.Element => (
          <Button
            key={chip.key}
            size="sm"
            variant="secondary"
            aria-label={`${chip.label} ×`}
            onClick={(): void => {
              if (chip.key === 'unassigned') {
                onUnassigned(false);
                setVisibleCount(30);
              } else change(chip.key, chip.key === 'type' ? 'all' : '');
            }}
          >
            {chip.label} <span aria-hidden="true">×</span>
          </Button>
        ))}
        {chips.length >= 2 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            {labels.clearAll}
          </Button>
        )}
      </div>
      {loading ? (
        <p role="status">{labels.loading}</p>
      ) : (
        <p>
          {labels.totals}:{' '}
          {(['income', 'expenses', 'movements'] as const)
            .map(
              (type): string =>
                `${labels[type]} ${formatBRL(totals[type], language)}`
            )
            .join(' · ')}{' '}
          ({filtered.length})
        </p>
      )}
      {!loading && filtered.length === 0 && <p>{labels.empty}</p>}
      <div
        role="group"
        aria-label={labels.sort}
        className="flex flex-wrap gap-1 sm:hidden"
      >
        {columns.map((column): JSX.Element => (
          <span key={column.key}>{sortButton(column)}</span>
        ))}
      </div>
      <div className="w-full min-w-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="hidden sm:table-header-group">
            <tr>
              {columns.map((column): JSX.Element => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortState(column.key)}
                  className={clsx(
                    column.key !== 'description' && columnDivider,
                    column.key === 'amount' && 'text-right'
                  )}
                >
                  {sortButton(column)}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">{labels.actions}</span>
              </th>
            </tr>
          </thead>
          {filtered.slice(0, visibleCount).map((entry): JSX.Element => {
            if (entry.transaction)
              return (
                <FinancialMovements
                  key={entry.key}
                  table
                  transaction={entry.transaction}
                  selectedDate={month}
                />
              );
            if (entry.movement)
              return (
                <MovementRow
                  key={entry.key}
                  table
                  movement={entry.movement}
                  names={names}
                  onRecord={onRecord}
                />
              );
            return (
              <tbody key={entry.key}>
                <tr>
                  <td>{entry.description ?? entry.search}</td>
                  <td>{entry.category}</td>
                  <td>{new Date(entry.date).toLocaleDateString()}</td>
                  <td>{formatBRL(entry.amount, language)}</td>
                  <td />
                </tr>
              </tbody>
            );
          })}
        </table>
      </div>
      {hasMore && (
        <div ref={sentinel} className="min-h-px" data-testid="entries-sentinel">
          {typeof IntersectionObserver === 'undefined' && (
            <Button
              onClick={(): void =>
                setVisibleCount((count): number => count + 30)
              }
            >
              {labels.loadMore}
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
