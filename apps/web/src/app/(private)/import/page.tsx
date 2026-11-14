'use client';

import { Input, Money } from '@/components';
import { TransactionType } from '@/enums';
import { useCategories } from '@/hooks';
import {
  PASSWORD_REQUIRED_STATUS,
  StatementImportError,
  statementImportService,
} from '@/services';
import type { Category } from '@/types';
import {
  applyCategory,
  describeStatus,
  formatStatementDate,
  statementSourceLabels,
  summarize,
  toImportLines,
  toRows,
  type ImportRow,
  type ImportSummary,
} from '@/utils/statementImport.util';
import type {
  StatementImportResult,
  StatementPreview,
} from '@budget-manager/api-client';
import clsx from 'clsx';
import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
} from 'react';
import { FiCheck, FiPlus, FiUpload } from 'react-icons/fi';

const panel =
  'rounded border border-[var(--ctp-surface1)] bg-[var(--ctp-surface0)]/90 p-4 shadow-md';
const field =
  'rounded-md border border-[var(--ctp-surface1)] bg-[var(--ctp-base)] px-3 py-2 text-sm text-[var(--ctp-text)] focus:border-[var(--ctp-blue)] focus:outline-none';
const primaryButton =
  'flex items-center justify-center gap-2 rounded-md px-4 py-2 font-medium transition';

function messageOf(error: unknown): string {
  return error instanceof StatementImportError
    ? error.message
    : 'Something went wrong. Try again.';
}

function buttonState(disabled: boolean): string {
  return disabled
    ? 'cursor-not-allowed bg-[var(--ctp-surface2)] text-[var(--ctp-subtext0)]'
    : 'cursor-pointer bg-[var(--ctp-blue)] text-[var(--ctp-crust)] hover:bg-[var(--ctp-lavender)]';
}

export default function ImportPage(): JSX.Element {
  const { data: expenseCategories, mutate: reloadExpenses } = useCategories(
    TransactionType.EXPENSE
  );
  const { data: incomeCategories, mutate: reloadIncome } = useCategories(
    TransactionType.INCOME
  );

  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState<string>('');
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  const [preview, setPreview] = useState<StatementPreview>();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [hideDuplicates, setHideDuplicates] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [result, setResult] = useState<StatementImportResult>();
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryType, setNewCategoryType] = useState<TransactionType>(
    TransactionType.EXPENSE
  );

  const summary: ImportSummary = useMemo(() => summarize(rows), [rows]);
  const visibleRows: ImportRow[] = hideDuplicates
    ? rows.filter((row: ImportRow): boolean => !row.line.duplicate)
    : rows;
  const canImport: boolean =
    summary.selected > 0 && summary.missingCategory === 0 && !isBusy;

  function categoriesFor(credit: boolean): Category[] {
    return (credit ? incomeCategories : expenseCategories) ?? [];
  }

  function handleFile({
    currentTarget: { files },
  }: ChangeEvent<HTMLInputElement>): void {
    setFile(files?.[0]);
    setPreview(undefined);
    setRows([]);
    setResult(undefined);
    setErrorMessage('');
    setNeedsPassword(false);
    setPassword('');
  }

  async function handleRead(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!file) {
      return;
    }
    setIsBusy(true);
    setErrorMessage('');
    setResult(undefined);
    try {
      const statement: StatementPreview = await statementImportService.preview(
        file,
        password || undefined
      );
      setPreview(statement);
      setRows(toRows(statement));
      setNeedsPassword(false);
    } catch (error: unknown) {
      setNeedsPassword(
        error instanceof StatementImportError &&
          error.status === PASSWORD_REQUIRED_STATUS
      );
      setErrorMessage(messageOf(error));
    } finally {
      setIsBusy(false);
    }
  }

  function updateRow(index: number, change: Partial<ImportRow>): void {
    setRows((current: ImportRow[]): ImportRow[] =>
      current.map((row: ImportRow): ImportRow =>
        row.line.index === index ? { ...row, ...change } : row
      )
    );
  }

  function selectAll(selected: boolean): void {
    setRows((current: ImportRow[]): ImportRow[] =>
      current.map((row: ImportRow): ImportRow =>
        !hideDuplicates || !row.line.duplicate ? { ...row, selected } : row
      )
    );
  }

  async function handleCreateCategory(): Promise<void> {
    const name: string = newCategoryName.trim();
    if (!name) {
      return;
    }
    setErrorMessage('');
    try {
      await statementImportService.createCategory(name, newCategoryType);
      setNewCategoryName('');
      await (newCategoryType === TransactionType.INCOME
        ? reloadIncome()
        : reloadExpenses());
    } catch (error: unknown) {
      setErrorMessage(messageOf(error));
    }
  }

  async function handleImport(): Promise<void> {
    setIsBusy(true);
    setErrorMessage('');
    try {
      const imported: StatementImportResult =
        await statementImportService.importLines(toImportLines(rows));
      setResult(imported);
      if (file) {
        const refreshed: StatementPreview =
          await statementImportService.preview(file, password || undefined);
        setPreview(refreshed);
        setRows(toRows(refreshed));
      }
    } catch (error: unknown) {
      setErrorMessage(messageOf(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form
          onSubmit={handleRead}
          className={clsx(panel, 'flex min-w-0 flex-col gap-3')}
        >
          <h1 className="text-base font-semibold text-[var(--ctp-text)]">
            Import a statement
          </h1>
          <p className="text-sm text-[var(--ctp-subtext1)]">
            Bradesco card PDF, NuBank card bill PDF or NuBank CSV. Nothing is
            saved until you review the lines and press Import.
          </p>
          <input
            aria-label="Statement file"
            type="file"
            accept=".pdf,.csv,application/pdf,text/csv"
            onChange={handleFile}
            className={clsx(field, 'cursor-pointer')}
          />
          {needsPassword && (
            <Input
              id="password"
              label="PDF password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={({
                currentTarget: { value },
              }: ChangeEvent<HTMLInputElement>): void => setPassword(value)}
            />
          )}
          <button
            type="submit"
            disabled={!file || isBusy}
            className={clsx(primaryButton, buttonState(!file || isBusy))}
          >
            <FiUpload />
            {isBusy && !preview ? 'Reading...' : 'Read statement'}
          </button>
          {errorMessage && (
            <span role="alert" className="text-sm text-[var(--ctp-red)]">
              {errorMessage}
            </span>
          )}
          {result && (
            <span role="status" className="text-sm text-[var(--ctp-green)]">
              Imported {result.imported}{' '}
              {result.imported === 1 ? 'transaction' : 'transactions'}
              {result.skippedAsDuplicates > 0 &&
                `, skipped ${result.skippedAsDuplicates} already saved`}
              .
            </span>
          )}

          <div className="mt-2 flex flex-col gap-2 border-t border-[var(--ctp-surface1)] pt-3">
            <span className="text-sm font-semibold text-[var(--ctp-subtext1)]">
              New category
            </span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
              <input
                aria-label="New category name"
                placeholder="Name"
                size={1}
                value={newCategoryName}
                onChange={({
                  currentTarget: { value },
                }: ChangeEvent<HTMLInputElement>): void =>
                  setNewCategoryName(value)
                }
                className={field}
              />
              <select
                aria-label="New category type"
                value={newCategoryType}
                onChange={({
                  currentTarget: { value },
                }: ChangeEvent<HTMLSelectElement>): void =>
                  setNewCategoryType(value as TransactionType)
                }
                className={field}
              >
                <option value={TransactionType.EXPENSE}>Expense</option>
                <option value={TransactionType.INCOME}>Income</option>
              </select>
              <button
                type="button"
                onClick={(): Promise<void> => handleCreateCategory()}
                disabled={!newCategoryName.trim()}
                title="Add category"
                className={clsx(
                  'rounded-md px-3',
                  buttonState(!newCategoryName.trim())
                )}
              >
                <FiPlus />
              </button>
            </div>
          </div>
        </form>

        {preview ? (
          <div className={clsx(panel, 'flex min-w-0 flex-col gap-3')}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--ctp-text)]">
                {statementSourceLabels[preview.source]}
              </h2>
              <span className="text-sm text-[var(--ctp-subtext1)]">
                {summary.total} lines · {summary.duplicates} already saved ·{' '}
                {summary.credits} credits
              </span>
            </div>
            {preview.printedTotal !== null &&
              preview.printedTotal !== undefined && (
                <div
                  className={clsx(
                    'rounded px-3 py-2 text-sm',
                    preview.totalsMatch
                      ? 'bg-[var(--ctp-green)]/15 text-[var(--ctp-green)]'
                      : 'bg-[var(--ctp-red)]/15 text-[var(--ctp-red)]'
                  )}
                >
                  {preview.totalsMatch
                    ? 'Every line was read: they add up to the statement total.'
                    : `Lines add up to ${preview.parsedTotal ?? 0} but the statement shows ${preview.printedTotal}. Some line may be missing; check before importing.`}
                </div>
              )}

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 text-[var(--ctp-text)]">
                <input
                  type="checkbox"
                  checked={hideDuplicates}
                  onChange={(): void => setHideDuplicates(!hideDuplicates)}
                />
                Hide already saved
              </label>
              <button
                type="button"
                onClick={(): void => selectAll(true)}
                className="cursor-pointer rounded px-2 py-1 text-[var(--ctp-blue)] hover:bg-[var(--ctp-surface1)]"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={(): void => selectAll(false)}
                className="cursor-pointer rounded px-2 py-1 text-[var(--ctp-blue)] hover:bg-[var(--ctp-surface1)]"
              >
                Select none
              </button>
              <select
                aria-label="Category for selected expenses"
                value=""
                onChange={({
                  currentTarget: { value },
                }: ChangeEvent<HTMLSelectElement>): void =>
                  setRows(applyCategory(rows, value, false))
                }
                className={field}
              >
                <option value="">Category for selected expenses…</option>
                {categoriesFor(false).map((category: Category): JSX.Element => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-[var(--ctp-subtext1)]">
                  <tr>
                    <th className="p-2" aria-label="Import" />
                    <th className="p-2">Date</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row: ImportRow): JSX.Element => (
                    <tr
                      key={row.line.index}
                      className={clsx(
                        'border-t border-[var(--ctp-surface1)]',
                        row.line.duplicate && 'opacity-60'
                      )}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label={`Import ${row.line.description}`}
                          checked={row.selected}
                          onChange={(): void =>
                            updateRow(row.line.index, {
                              selected: !row.selected,
                            })
                          }
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {formatStatementDate(row.line.date)}
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-[var(--ctp-text)]">
                          {row.line.description}
                        </div>
                        <div className="text-xs text-[var(--ctp-subtext0)]">
                          {row.line.installmentNumber &&
                            row.line.installmentTotal &&
                            `Installment ${row.line.installmentNumber}/${row.line.installmentTotal} · creates all ${row.line.installmentTotal} · `}
                          {row.line.cardholder}
                        </div>
                      </td>
                      <td
                        className={clsx(
                          'p-2 text-right whitespace-nowrap',
                          row.line.credit && 'text-[var(--ctp-green)]'
                        )}
                      >
                        <Money
                          value={
                            row.line.credit ? -row.line.amount : row.line.amount
                          }
                        />
                      </td>
                      <td className="p-2">
                        <select
                          aria-label={`Category for ${row.line.description}`}
                          value={row.categoryId}
                          onChange={({
                            currentTarget: { value },
                          }: ChangeEvent<HTMLSelectElement>): void =>
                            updateRow(row.line.index, { categoryId: value })
                          }
                          className={clsx(
                            field,
                            'w-full',
                            row.selected &&
                              !row.categoryId &&
                              'border-[var(--ctp-red)]'
                          )}
                        >
                          <option value="">
                            {row.line.credit
                              ? 'Income category…'
                              : 'Expense category…'}
                          </option>
                          {categoriesFor(row.line.credit).map(
                            (category: Category): JSX.Element => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap text-[var(--ctp-subtext1)]">
                        {describeStatus(row.line)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ctp-surface1)] pt-3">
              <span className="text-sm text-[var(--ctp-subtext1)]">
                {summary.selected} selected
                {summary.missingCategory > 0 &&
                  ` · ${summary.missingCategory} still need a category`}
              </span>
              <div className="flex items-center gap-3">
                <Money
                  className="text-sm font-semibold"
                  value={summary.selectedAmount}
                />
                <button
                  type="button"
                  onClick={(): Promise<void> => handleImport()}
                  disabled={!canImport}
                  className={clsx(primaryButton, buttonState(!canImport))}
                >
                  <FiCheck />
                  {isBusy ? 'Importing...' : `Import ${summary.selected}`}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={clsx(
              panel,
              'flex items-center justify-center text-sm text-[var(--ctp-subtext1)]'
            )}
          >
            Choose a statement to see its lines here.
          </div>
        )}
      </section>
    </div>
  );
}
