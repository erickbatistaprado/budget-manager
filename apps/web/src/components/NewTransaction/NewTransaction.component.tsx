'use client';

import { DatePickerDialog, Input, SelectWithTooltip } from '@/components';
import { RepeatInterval, TransactionType } from '@/enums';
import { useCategories } from '@/hooks';
import { useI18n } from '@/i18n/useI18n';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import { postFetcher, putFetcher } from '@/libs/fetchers.lib';
import type { Category, Transaction } from '@/types';
import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';
import { monthlyOccurrence, monthKey } from '@/utils/monthlyTransaction.util';
import clsx from 'clsx';
import {
  useId,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type JSX,
  type SetStateAction,
} from 'react';
import { BsFillCreditCard2BackFill } from 'react-icons/bs';
import { FcCurrencyExchange, FcIdea, FcSurvey } from 'react-icons/fc';
import { GrTransaction } from 'react-icons/gr';
import { MdEventRepeat } from 'react-icons/md';

function subscribeToNothing(): () => void {
  return (): void => {};
}

/**
 * True only in the browser. The server runs in UTC, so between 21:00 and midnight in Brazil it is
 * already tomorrow there: "today" must be chosen in the browser, or the date shown would be a day
 * off and React would report a hydration mismatch.
 */
function useIsBrowser(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    (): boolean => true,
    (): boolean => false
  );
}

export interface NewTransactionProps {
  transaction?: Transaction;
  selectedDate?: Date;
  onClose: () => void;
}

export default function NewTransaction({
  transaction,
  selectedDate,
  onClose,
}: Readonly<NewTransactionProps>): JSX.Element {
  const { t, language } = useI18n();
  const monthly = transaction?.repeats === RepeatInterval.MONTHLY;
  const month =
    selectedDate ?? (transaction ? parseApiDate(transaction.date) : new Date());
  const occurrence =
    monthly && transaction ? monthlyOccurrence(transaction, month) : null;
  const initial =
    transaction && occurrence
      ? {
          ...transaction,
          totalValue: occurrence.amount,
          notes: occurrence.notes,
          date: getApiDate(occurrence.date),
        }
      : transaction;
  const [scope, setScope] = useState<'month' | 'following' | undefined>();
  const monthLabel = month.toLocaleDateString(
    language === 'pt' ? 'pt-BR' : 'en-US',
    { month: 'long' }
  );
  const fieldId: string = useId();
  const [form, setForm] = useState<Partial<Transaction>>(
    initial ?? { repeats: RepeatInterval.NONE }
  );
  const isBrowser: boolean = useIsBrowser();
  const [pickedDate, setPickedDate] = useState<Date | undefined>(
    initial?.date ? parseApiDate(initial.date) : undefined
  );
  const date: Date | undefined =
    pickedDate ?? (isBrowser ? new Date() : undefined);
  const setDate: Dispatch<SetStateAction<Date>> = (
    value: SetStateAction<Date>
  ): void =>
    setPickedDate((current: Date | undefined): Date =>
      typeof value === 'function' ? value(current ?? new Date()) : value
    );
  const [transactionType, setTransactionType] = useState<TransactionType | ''>(
    form.category?.transactionType ?? ''
  );
  const { data: categories } = useCategories(
    transactionType as TransactionType
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setErrorMessage('');

    const totalValue: number = Number(form.totalValue);
    const installmentNumbers: number = Number(form.installmentNumbers);

    if (!Number.isFinite(totalValue) || totalValue <= 0) {
      setErrorMessage(t.transactions.valueGreaterThanZero);
      return;
    }
    if (!form.category?.id) {
      setErrorMessage(t.transactions.selectCategoryError);
      return;
    }
    if (
      isInstallmentsEnabled &&
      form.installmentNumbers &&
      (!Number.isInteger(installmentNumbers) || installmentNumbers <= 1)
    ) {
      setErrorMessage(t.transactions.invalidInstallments);
      return;
    }
    if (isSubmitting) {
      return;
    }

    if (monthly && (!scope || !date || monthKey(date) !== monthKey(month))) {
      setErrorMessage(t.transactions.dateInMonth);
      return;
    }

    const body: string = JSON.stringify({
      id: form.id,
      notes: form.notes?.trim() || null,
      totalValue,
      installmentNumbers:
        isInstallmentsEnabled && form.installmentNumbers
          ? installmentNumbers
          : null,
      installments: form.installments ?? null,
      repeats: form.repeats ?? RepeatInterval.NONE,
      category: form.category,
      date: getApiDate(date ?? new Date()),
    });

    try {
      setIsSubmitting(true);
      if (monthly && form.id) {
        if (scope === 'month') {
          await putFetcher<Transaction>(
            `/transactions/${form.id}/months/${monthKey(month)}`,
            {
              body: JSON.stringify({
                amount: totalValue,
                date: getApiDate(date ?? month),
                notes: form.notes?.trim() || null,
              }),
            }
          );
        } else {
          await postFetcher<Transaction>(
            `/transactions/${form.id}/split/${monthKey(month)}`,
            { body }
          );
        }
      } else if (form.id) {
        await putFetcher<Transaction>('/transactions', { body });
      } else {
        await postFetcher<Transaction>('/transactions', { body });
      }
      await refreshTransactions();
      setForm({ repeats: RepeatInterval.NONE });
      setTransactionType('');
      onClose();
    } catch (error: unknown) {
      console.error(error);
      setErrorMessage(t.transactions.saveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChange({
    currentTarget: { value, name },
  }: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void {
    setForm(
      (prevForm: Partial<Transaction> | undefined): Partial<Transaction> => ({
        ...prevForm,
        [name]:
          name === 'category'
            ? categories?.find(
                (categoryItem: Category): boolean => categoryItem.id === value
              )
            : value,
      })
    );
  }

  function handleTransactionTypeChange({
    currentTarget: { value },
  }: ChangeEvent<HTMLSelectElement>): void {
    setTransactionType(value as TransactionType);
    setForm((prevForm: Partial<Transaction>): Partial<Transaction> => ({
      ...prevForm,
      category: undefined,
      installmentNumbers: undefined,
    }));
  }

  function handleOnClose(): void {
    setForm({ repeats: RepeatInterval.NONE });
    setTransactionType('');
    onClose();
  }

  const isInstallmentsEnabled: boolean = Boolean(
    form.repeats === RepeatInterval.NONE &&
    transactionType === TransactionType.EXPENSE
  );
  const totalValue: number = Number(form.totalValue);
  const isSaveDisabled: boolean = Boolean(
    !Number.isFinite(totalValue) || totalValue <= 0 || !form.category?.id
  );

  if (monthly && !scope) {
    return (
      <div className="flex h-full flex-col justify-center gap-4 p-5">
        <p>{t.transactions.earlierUnchanged}</p>
        <button type="button" onClick={(): void => setScope('month')}>
          {t.transactions.onlyMonth(monthLabel)}
        </button>
        <button type="button" onClick={(): void => setScope('following')}>
          {t.transactions.fromMonth(monthLabel)}
        </button>
        <button type="button" onClick={onClose}>
          {t.common.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--ctp-surface0)]/55 p-5 text-[var(--ctp-text)] backdrop-blur-xs">
      <div className="flex items-center justify-center">
        {date ? (
          <DatePickerDialog date={date} setDate={setDate} arrows />
        ) : (
          <div aria-hidden className="h-10" />
        )}
      </div>
      <form
        className="flex h-full w-full flex-col gap-5 rounded-lg"
        id={`${fieldId}-form`}
        onSubmit={onSubmit}
      >
        <SelectWithTooltip
          id={`${fieldId}-repeats`}
          name="repeats"
          disabled={monthly}
          tooltip={t.transactions.repeatsTooltip}
          icon={
            <MdEventRepeat className="text-[var(--ctp-yellow)]" size={25} />
          }
          value={form.repeats}
          onChange={handleChange}
          options={[
            { label: t.transactions.repeatsNone, value: RepeatInterval.NONE },
            {
              label: t.transactions.repeatsMonthly,
              value: RepeatInterval.MONTHLY,
            },
          ]}
        />
        <SelectWithTooltip
          id={`${fieldId}-transactionType`}
          name="transactionType"
          disabled={monthly}
          tooltip={t.transactions.typeTooltip}
          icon={<GrTransaction className="text-[var(--ctp-green)]" size={25} />}
          value={transactionType}
          onChange={handleTransactionTypeChange}
          options={[
            { label: t.transactions.selectType, value: '' },
            { label: t.common.expense, value: 'EXPENSE' },
            { label: t.common.income, value: 'INCOME' },
          ]}
        />
        <SelectWithTooltip
          id={`${fieldId}-category`}
          name="category"
          tooltip={t.transactions.categoryTooltip}
          icon={<FcIdea size={25} />}
          value={form.category?.id || ''}
          onChange={handleChange}
          options={[
            { label: t.transactions.selectCategory, value: '' },
            ...(categories
              ?.slice()
              .sort(
                (firstCategory: Category, secondCategory: Category): number =>
                  firstCategory.name.localeCompare(secondCategory.name)
              )
              .map(
                ({ name, id }: Category): { label: string; value: string } => ({
                  label: name,
                  value: id,
                })
              ) ?? []),
          ]}
          disabled={!categories?.length || (monthly && scope === 'month')}
        />
        {isInstallmentsEnabled && (
          <div className="flex flex-col gap-1">
            <BsFillCreditCard2BackFill
              className="text-[var(--ctp-mauve)]"
              size={25}
            />
            <Input
              id={`${fieldId}-installmentNumbers`}
              name="installmentNumbers"
              label={t.transactions.numberOfInstallments}
              type="number"
              min={2}
              step={1}
              value={form.installmentNumbers?.toString() ?? ''}
              onChange={handleChange}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <FcSurvey size={25} />
          <Input
            id={`${fieldId}-notes`}
            name="notes"
            label={t.common.notes}
            type="text"
            value={form.notes ?? ''}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-1">
          <FcCurrencyExchange size={25} />
          <Input
            className="no-spinner"
            id={`${fieldId}-totalValue`}
            name="totalValue"
            label={t.common.value}
            type="number"
            min={0.01}
            step={0.01}
            value={form.totalValue?.toString() ?? ''}
            onChange={handleChange}
          />
        </div>
        {errorMessage && (
          <p className="text-sm text-[var(--ctp-red)]">{errorMessage}</p>
        )}
        <div className="flex w-full items-center justify-center gap-2">
          <button
            className="h-12 w-full cursor-pointer rounded-md bg-[var(--ctp-surface1)] font-bold text-[var(--ctp-text)] hover:bg-[var(--ctp-surface2)]"
            type="button"
            onClick={handleOnClose}
          >
            {t.common.cancel}
          </button>
          <button
            className={clsx(
              'h-12 w-full rounded-md font-bold',
              isSaveDisabled || isSubmitting
                ? 'cursor-not-allowed bg-[var(--ctp-surface0)] text-[var(--ctp-overlay0)]'
                : 'cursor-pointer bg-[var(--ctp-blue)] text-[var(--ctp-crust)] hover:bg-[var(--ctp-lavender)]'
            )}
            type="submit"
            disabled={isSaveDisabled || isSubmitting}
          >
            {isSubmitting ? t.common.saving : t.common.save}
          </button>
        </div>
      </form>
    </div>
  );
}
