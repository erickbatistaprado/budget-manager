'use client';

import { InstallmentPrepayment, Money, NewTransaction } from '@/components';
import { paymentLabel } from '@/utils/payment.util';
import { useI18n } from '@/i18n/useI18n';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import { deleteFetcher } from '@/libs/fetchers.lib';
import type { Installment, Transaction } from '@/types';
import {
  formatDate,
  getApiDate,
  parseApiDate,
} from '@/utils/globalFormats.util';
import {
  amountInMonth,
  describeInstallments,
  installmentsInMonth,
} from '@/utils/installments.util';
import { monthlyOccurrence, monthKey } from '@/utils/monthlyTransaction.util';
import clsx from 'clsx';
import { useMemo, useState, type JSX } from 'react';
import { BiEdit } from 'react-icons/bi';
import { FcFullTrash } from 'react-icons/fc';
import { FiFastForward } from 'react-icons/fi';

export interface FinancialMovementsProps {
  transaction: Transaction;
  selectedDate: Date;
}

const dangerButton =
  'cursor-pointer rounded bg-[var(--ctp-red)]/25 px-2 py-1 text-xs font-semibold whitespace-nowrap text-[var(--ctp-red)] disabled:opacity-50';
const cancelButton =
  'cursor-pointer rounded bg-[var(--ctp-surface1)] px-2 py-1 text-xs font-semibold whitespace-nowrap text-[var(--ctp-text)] hover:bg-[var(--ctp-surface2)] disabled:opacity-50';

export default function FinancialMovements({
  transaction,
  selectedDate,
}: Readonly<FinancialMovementsProps>): JSX.Element {
  const { language, t } = useI18n();
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPrepaying, setIsPrepaying] = useState<boolean>(false);

  const monthly = transaction.repeats === 'MONTHLY';
  const occurrence = monthly
    ? monthlyOccurrence(transaction, selectedDate)
    : null;
  const monthLabel = selectedDate.toLocaleDateString(
    language === 'pt' ? 'pt-BR' : 'en-US',
    { month: 'long' }
  );

  async function deleteTransaction(
    scope?: 'month' | 'following'
  ): Promise<void> {
    setErrorMessage('');

    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    try {
      setIsDeleting(true);
      let path = `/transactions/${transaction.id}`;
      if (monthly) {
        path +=
          scope === 'following'
            ? `/from/${monthKey(selectedDate)}`
            : `/months/${monthKey(selectedDate)}`;
      }
      await deleteFetcher(path);
      await refreshTransactions();
    } catch (error: unknown) {
      console.error(error);
      setErrorMessage(t.transactions.deleteError);
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  }

  function onEditOrClose(): void {
    setIsEditOpen((prev: boolean): boolean => !prev);
  }

  function getDate(): string {
    if (monthly && occurrence) {
      return formatDate(getApiDate(occurrence.date), language);
    }
    if (transaction.repeats !== 'NONE') {
      const day: string = parseApiDate(transaction.date)
        .getDate()
        .toString()
        .padStart(2, '0');
      const repeatsLabel: string =
        transaction.repeats === 'MONTHLY'
          ? t.transactions.repeatsMonthly
          : transaction.repeats;
      return t.transactions.dayAndRepeat(day, repeatsLabel);
    }
    if (currentInstallment) {
      return formatDate(currentInstallment.dueDate, language);
    }
    return formatDate(transaction.date, language);
  }

  const dueThisMonth: Installment[] = installmentsInMonth(
    transaction,
    selectedDate
  );
  const currentInstallment: Installment | undefined = dueThisMonth[0];
  const paidEarlyThisMonth: boolean = dueThisMonth.some(
    (installment: Installment): boolean => installment.paidEarly
  );

  const calculateInstallmentAmount: number = useMemo(
    (): number => amountInMonth(transaction, selectedDate),
    [transaction, selectedDate]
  );

  if (monthly && !occurrence) {
    return <></>;
  }

  return (
    <div className="grid grid-cols-4 border-b-2 border-[var(--ctp-surface1)] text-lg">
      {isEditOpen && (
        <button
          className="fixed inset-0 z-40 bg-[var(--ctp-crust)]/25 backdrop-blur-xs transition-opacity"
          onClick={onEditOrClose}
        />
      )}
      <div className="flex items-center justify-start gap-2">
        <button
          type="button"
          aria-label={t.transactions.editAriaLabel}
          onClick={onEditOrClose}
        >
          <BiEdit
            className="cursor-pointer text-[var(--ctp-subtext1)] transition-colors duration-500 hover:text-[var(--ctp-subtext0)]"
            size={22}
          />
        </button>
        <span className="truncate">
          {transaction.category.name}{' '}
          {describeInstallments(transaction, selectedDate)}
          {occurrence?.changed && (
            <span className="ml-1 text-xs text-[var(--ctp-subtext0)]">
              {t.transactions.changedThisMonth}
            </span>
          )}
          {paidEarlyThisMonth && (
            <span className="ml-1 rounded bg-[var(--ctp-green)]/15 px-1 text-xs text-[var(--ctp-green)]">
              {t.transactions.paidEarly}
            </span>
          )}
        </span>
        {Boolean(transaction.installmentNumbers) && (
          <button
            type="button"
            aria-label={t.transactions.payInstallmentsEarly}
            title={t.transactions.payInstallmentsEarly}
            onClick={(): void => setIsPrepaying(!isPrepaying)}
            className="cursor-pointer text-[var(--ctp-subtext1)] transition-colors hover:text-[var(--ctp-blue)]"
          >
            <FiFastForward size={18} />
          </button>
        )}
      </div>
      <div className="truncate">
        {occurrence ? occurrence.notes : transaction.notes}
      </div>
      <div className="truncate">
        {getDate()}
        <span className="ml-1 text-xs text-[var(--ctp-subtext0)]">
          {paymentLabel(transaction, t.payments.methods)}
        </span>
        {transaction.billDueDate && (
          <span className="ml-1 rounded bg-[var(--ctp-blue)]/15 px-1 text-xs">
            {t.cards.billMonth(
              parseApiDate(transaction.billDueDate)
                .toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
                  month: 'short',
                })
                .replace('.', '')
            )}
          </span>
        )}
        {transaction.card && transaction.installmentNumbers && (
          <span className="block text-xs">
            {formatDate(transaction.date, language)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        <Money className="truncate" value={calculateInstallmentAmount} />
        {errorMessage && (
          <span className="truncate text-xs text-[var(--ctp-red)]">
            {errorMessage}
          </span>
        )}
        {!isConfirmingDelete && (
          <button
            aria-label={t.transactions.deleteAriaLabel}
            className="cursor-pointer"
            disabled={isDeleting}
            onClick={(): void => {
              void deleteTransaction();
            }}
            type="button"
          >
            <FcFullTrash size={22} />
          </button>
        )}
      </div>
      {isConfirmingDelete && (
        <div className="col-span-4 mb-2 flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--ctp-surface0)] px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-semibold">
              {t.transactions.deleteTitle(
                transaction.notes || transaction.category.name
              )}
            </p>
            {monthly && (
              <p className="text-xs text-[var(--ctp-subtext0)]">
                {t.transactions.earlierUnchanged}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDeleting && <span className="text-xs">{t.common.deleting}</span>}
            {!isDeleting && !monthly && (
              <button
                className={dangerButton}
                onClick={(): void => {
                  void deleteTransaction('month');
                }}
                type="button"
              >
                {t.common.delete}
              </button>
            )}
            {!isDeleting && monthly && (
              <>
                <button
                  className={dangerButton}
                  onClick={(): void => {
                    void deleteTransaction('month');
                  }}
                  type="button"
                >
                  {t.transactions.onlyMonth(monthLabel)}
                </button>
                <button
                  className={dangerButton}
                  onClick={(): void => {
                    void deleteTransaction('following');
                  }}
                  type="button"
                >
                  {t.transactions.fromMonth(monthLabel)}
                </button>
              </>
            )}
            <button
              className={cancelButton}
              disabled={isDeleting}
              onClick={(): void => setIsConfirmingDelete(false)}
              type="button"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
      <div
        className={clsx(
          'fixed top-0 right-0 z-50 h-full w-[400px] transform bg-[var(--ctp-mantle)] shadow-lg transition-transform duration-300 md:w-[500px]',
          isEditOpen
            ? 'pointer-events-auto translate-x-0'
            : 'pointer-events-none translate-x-full'
        )}
      >
        {isEditOpen && (
          <NewTransaction
            onClose={onEditOrClose}
            transaction={transaction}
            selectedDate={selectedDate}
          />
        )}
      </div>
      {isPrepaying && (
        <InstallmentPrepayment
          transaction={transaction}
          onChanged={refreshTransactions}
          onClose={(): void => setIsPrepaying(false)}
        />
      )}
    </div>
  );
}
