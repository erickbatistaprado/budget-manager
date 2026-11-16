'use client';

import { control } from '@/components/ui/styles';

import {
  Panel,
  Button,
  TextInput,
  Select,
  Checkbox,
  Field,
  DateField,
  parseFieldDate,
  formatFieldDate,
} from '@/components/ui';
import { Input, Money } from '@/components';
import { TransactionType } from '@/enums';
import { useCategories } from '@/hooks';
import useCards from '@/hooks/useCards.hook';
import { nextCardDueDate } from '@/utils/cardBill.util';
import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';
import { useI18n } from '@/i18n/useI18n';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import {
  PASSWORD_REQUIRED_STATUS,
  StatementImportError,
  statementImportService,
} from '@/services';
import type { Category } from '@/types';
import {
  applyCategory,
  chooseCategory,
  describeLineDetails,
  describeStatus,
  describeSuggestion,
  formatStatementDate,
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
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
} from 'react';
import { FiCheck, FiCheckCircle, FiPlus, FiUpload } from 'react-icons/fi';

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof StatementImportError) {
    return error.message;
  }
  return fallback;
}

export default function ImportPage(): JSX.Element {
  const { t, language } = useI18n();
  const { data: cards } = useCards();
  const [cardId, setCardId] = useState('');
  const [billDueDate, setBillDueDate] = useState('');

  function defaultBillDate(
    statement: StatementPreview,
    selectedCardId: string
  ): string {
    if (statement.billDueDate) {
      return statement.billDueDate.replaceAll('/', '-');
    }
    const card = cards?.find(
      (candidate): boolean => candidate.id === selectedCardId
    );
    const dates = statement.lines.map((line): string => line.date).sort();
    const statementDate = statement.statementDate ?? dates.at(-1);
    if (!card || !statementDate) {
      return '';
    }
    return getApiDate(
      nextCardDueDate(parseApiDate(statementDate), card.dueDay)
    ).replaceAll('/', '-');
  }
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
  const resultRef = useRef<HTMLDivElement>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryType, setNewCategoryType] = useState<TransactionType>(
    TransactionType.EXPENSE
  );

  const summary: ImportSummary = useMemo(
    (): ImportSummary => summarize(rows),
    [rows]
  );
  const visibleRows: ImportRow[] = hideDuplicates
    ? rows.filter((row: ImportRow): boolean => !row.line.duplicate)
    : rows;
  const canImport: boolean =
    (summary.selected > 0 ||
      Boolean(
        billDueDate &&
        rows.some(
          (row): boolean => row.line.duplicate && Boolean(row.categoryId)
        )
      )) &&
    summary.missingCategory === 0 &&
    !isBusy;

  function importButtonLabel(): string {
    if (summary.selected === 0 && billDueDate) {
      return t.cards.applyBillDates;
    }
    return t.import.importCount(summary.selected);
  }

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
        password || undefined,
        cardId || undefined,
        billDueDate ? billDueDate.replaceAll('-', '/') : undefined
      );
      setPreview(statement);
      setBillDueDate(defaultBillDate(statement, cardId));
      setRows(toRows(statement));
      setNeedsPassword(false);
    } catch (error: unknown) {
      setNeedsPassword(
        error instanceof StatementImportError &&
          error.status === PASSWORD_REQUIRED_STATUS
      );
      setErrorMessage(messageOf(error, t.common.errorGeneric));
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshPreview(
    selectedCard: string,
    selectedBill: string
  ): Promise<void> {
    if (!file) return;
    setIsBusy(true);
    try {
      const statement = await statementImportService.preview(
        file,
        password || undefined,
        selectedCard || undefined,
        selectedBill ? selectedBill.replaceAll('-', '/') : undefined
      );
      setPreview(statement);
      setRows(toRows(statement));
    } catch (error: unknown) {
      setErrorMessage(messageOf(error, t.common.errorGeneric));
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
      setErrorMessage(messageOf(error, t.common.errorGeneric));
    }
  }

  useEffect((): void => {
    if (result) {
      resultRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      });
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [result]);

  async function handleImport(): Promise<void> {
    setIsBusy(true);
    setErrorMessage('');
    try {
      const imported: StatementImportResult =
        await statementImportService.importLines(
          toImportLines(rows, Boolean(billDueDate)),
          cardId || undefined,
          billDueDate ? billDueDate.replaceAll('-', '/') : undefined
        );
      setResult(imported);
      await refreshTransactions();
      if (file) {
        const refreshed: StatementPreview =
          await statementImportService.preview(
            file,
            password || undefined,
            cardId || undefined,
            billDueDate ? billDueDate.replaceAll('-', '/') : undefined
          );
        setPreview(refreshed);
        setRows(toRows(refreshed));
      }
    } catch (error: unknown) {
      setErrorMessage(messageOf(error, t.common.errorGeneric));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Panel
          as="form"
          onSubmit={handleRead}
          className="flex min-w-0 flex-col gap-3"
        >
          <h1 className="text-base font-semibold text-[var(--ctp-text)]">
            {t.import.title}
          </h1>
          <p className="text-sm text-[var(--ctp-subtext1)]">
            {t.import.description}
          </p>
          <input
            aria-label={t.import.statementFile}
            type="file"
            accept=".pdf,.csv,application/pdf,text/csv"
            onChange={handleFile}
            className={clsx(control, 'cursor-pointer')}
          />
          {needsPassword && (
            <Input
              id="password"
              label={t.import.pdfPassword}
              type="password"
              autoComplete="off"
              value={password}
              onChange={({
                currentTarget: { value },
              }: ChangeEvent<HTMLInputElement>): void => setPassword(value)}
            />
          )}
          <Button variant="primary" type="submit" disabled={!file || isBusy}>
            <FiUpload />
            {isBusy && !preview ? t.import.reading : t.import.readStatement}
          </Button>
          {errorMessage && (
            <span role="alert" className="text-sm text-[var(--ctp-red)]">
              {errorMessage}
            </span>
          )}

          <div className="mt-2 flex flex-col gap-2 border-t border-[var(--ctp-surface1)] pt-3">
            <span className="text-sm font-semibold text-[var(--ctp-subtext1)]">
              {t.import.newCategory}
            </span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
              <TextInput
                aria-label={t.import.newCategoryName}
                placeholder={t.common.name}
                size="small"
                value={newCategoryName}
                onChange={({
                  currentTarget: { value },
                }: ChangeEvent<HTMLInputElement>): void =>
                  setNewCategoryName(value)
                }
              />
              <Select
                aria-label={t.import.newCategoryType}
                value={newCategoryType}
                onChange={({
                  currentTarget: { value },
                }: ChangeEvent<HTMLSelectElement>): void =>
                  setNewCategoryType(value as TransactionType)
                }
              >
                <option value={TransactionType.EXPENSE}>
                  {t.common.expense}
                </option>
                <option value={TransactionType.INCOME}>
                  {t.common.income}
                </option>
              </Select>
              <Button
                variant="secondary"
                type="button"
                onClick={(): Promise<void> => handleCreateCategory()}
                disabled={!newCategoryName.trim()}
                aria-label={t.import.addCategory}
                title={t.import.addCategory}
              >
                <FiPlus />
              </Button>
            </div>
          </div>
        </Panel>

        {preview ? (
          <Panel className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--ctp-text)]">
                {t.import.sources[preview.source]}
              </h2>
              <span className="text-sm text-[var(--ctp-subtext1)]">
                {t.import.summary(
                  summary.total,
                  summary.duplicates,
                  summary.credits,
                  summary.suggested
                )}
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
                    ? t.import.totalsMatch
                    : t.import.totalsMismatch(
                        preview.parsedTotal ?? 0,
                        preview.printedTotal
                      )}
                </div>
              )}

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Checkbox
                label={t.import.hideAlreadySaved}
                checked={hideDuplicates}
                onChange={(): void => setHideDuplicates(!hideDuplicates)}
              />
              <Button
                variant="primary"
                type="button"
                onClick={(): void => selectAll(true)}
              >
                {t.import.selectAll}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={(): void => selectAll(false)}
              >
                {t.import.selectNone}
              </Button>
              <Select
                aria-label={t.import.categoryForSelected}
                value=""
                onChange={({
                  currentTarget: { value },
                }: ChangeEvent<HTMLSelectElement>): void =>
                  setRows(applyCategory(rows, value, false))
                }
              >
                <option value="">{t.import.categoryForSelected}</option>
                {categoriesFor(false).map((category: Category): JSX.Element => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-3">
              <Field label={t.cards.card}>
                <Select
                  aria-label={t.cards.card}
                  value={cardId}
                  onChange={(event): void => {
                    const selectedCard = event.currentTarget.value;
                    void refreshPreview(
                      selectedCard,
                      defaultBillDate(preview, selectedCard)
                    );
                    setCardId(selectedCard);
                    setBillDueDate(
                      defaultBillDate(preview, event.currentTarget.value)
                    );
                  }}
                >
                  <option value="">{t.cards.noCard}</option>
                  {cards?.map((card): JSX.Element => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.cards.billDueDate}>
                <DateField
                  aria-label={t.cards.billDueDate}

                  value={parseFieldDate(billDueDate)}
                  onChange={(pickedDate): void => {
                    const selectedBill = formatFieldDate(pickedDate);
                    setBillDueDate(selectedBill);
                    void refreshPreview(cardId, selectedBill);
                  }}
                />
              </Field>
            </div>
            {billDueDate && (
              <p className="text-sm text-[var(--ctp-subtext1)]">
                {t.cards.reimportHint}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-[var(--ctp-subtext1)]">
                  <tr>
                    <th className="p-2" aria-label={t.import.importColumn} />
                    <th className="p-2">{t.common.date}</th>
                    <th className="p-2">{t.import.descriptionColumn}</th>
                    <th className="p-2 text-right">{t.common.value}</th>
                    <th className="p-2">{t.common.category}</th>
                    <th className="p-2">{t.import.statusColumn}</th>
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
                        <Checkbox
                          aria-label={t.import.importRow(row.line.description)}
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
                          {describeLineDetails(row.line, t.import)}
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
                        <Select
                          className="w-full"
                          aria-label={t.import.categoryForRow(
                            row.line.description
                          )}
                          value={row.categoryId}
                          onChange={({
                            currentTarget: { value },
                          }: ChangeEvent<HTMLSelectElement>): void =>
                            setRows(chooseCategory(rows, row.line.index, value))
                          }
                        >
                          <option value="">
                            {row.line.credit
                              ? t.import.incomeCategoryPlaceholder
                              : t.import.expenseCategoryPlaceholder}
                          </option>
                          {categoriesFor(row.line.credit).map(
                            (category: Category): JSX.Element => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            )
                          )}
                        </Select>
                        {describeSuggestion(row, t.import) && (
                          <div className="mt-1 text-xs text-[var(--ctp-subtext0)]">
                            {describeSuggestion(row, t.import)}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap text-[var(--ctp-subtext1)]">
                        {describeStatus(row.line, t.import)}
                        {row.line.subscriptionName && (
                          <div>{row.line.subscriptionName}</div>
                        )}
                        {row.line.updateMonthAvailable && (
                          <Checkbox
                            label={t.import.updateMonth(
                              new Intl.NumberFormat(
                                language === 'pt' ? 'pt-BR' : 'en-US',
                                { style: 'currency', currency: 'BRL' }
                              ).format(row.line.amount)
                            )}
                            checked={row.updateMonth ?? false}
                            onChange={(): void =>
                              updateRow(row.line.index, {
                                updateMonth: !row.updateMonth,
                                selected: !row.updateMonth,
                              })
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result && (
              <Panel
                as="div"
                ref={resultRef}
                role="status"
                tabIndex={-1}
                className="flex flex-wrap items-center gap-3 text-sm text-[var(--ctp-text)] focus:outline-none"
              >
                <FiCheckCircle
                  aria-hidden
                  className="shrink-0 text-lg text-[var(--ctp-green)]"
                />
                <span className="min-w-0 flex-1 font-medium">
                  {result.installmentAmountsAdjusted > 0 && (
                    <span>
                      {t.import.installmentAmountsAdjusted(
                        result.installmentAmountsAdjusted
                      )}
                      .{' '}
                    </span>
                  )}
                  {result.billDatesSet > 0 && (
                    <span>{t.cards.moved(result.billDatesSet)}. </span>
                  )}
                  {t.import.importSuccess(
                    result.imported,
                    result.skippedAsDuplicates,
                    result.movedInstallments
                  )}
                </span>
                {result.imported > 0 && (
                  <Link
                    href="/"
                    className="font-medium text-[var(--ctp-blue)] underline-offset-2 hover:underline"
                  >
                    {t.import.seeOnHome}
                  </Link>
                )}
              </Panel>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ctp-surface1)] pt-3">
              <span className="text-sm text-[var(--ctp-subtext1)]">
                {t.import.selectedCount(
                  summary.selected,
                  summary.missingCategory
                )}
              </span>
              <div className="flex items-center gap-3">
                <Money
                  className="text-sm font-semibold"
                  value={summary.selectedAmount}
                />
                <Button
                  variant="primary"
                  type="button"
                  onClick={(): Promise<void> => handleImport()}
                  disabled={!canImport}
                >
                  <FiCheck />
                  {isBusy ? t.import.importing : importButtonLabel()}
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel className="flex items-center justify-center text-sm text-[var(--ctp-subtext1)]">
            {t.import.emptyPreview}
          </Panel>
        )}
      </section>
    </div>
  );
}
