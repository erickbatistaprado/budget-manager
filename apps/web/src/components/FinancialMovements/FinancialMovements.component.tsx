'use client';

import { InstallmentPrepayment, Money, NewTransaction } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import { deleteFetcher } from '@/libs/fetchers.lib';
import type { Installment, Transaction } from '@/types';
import { formatDate, parseApiDate } from '@/utils/globalFormats.util';
import {
  amountInMonth,
  describeInstallments,
  installmentsInMonth,
} from '@/utils/installments.util';
import clsx from 'clsx';
import { useMemo, useState, type JSX } from 'react';
import { BiEdit } from 'react-icons/bi';
import { FcFullTrash } from 'react-icons/fc';
import { FiFastForward } from 'react-icons/fi';

export interface FinancialMovementsProps {
  transaction: Transaction;
  mutateOnDelete: () => Promise<unknown>;
  selectedDate: Date;
}

export default function FinancialMovements({
  transaction,
  mutateOnDelete,
  selectedDate,
}: Readonly<FinancialMovementsProps>): JSX.Element {
  const { language, t } = useI18n();
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPrepaying, setIsPrepaying] = useState<boolean>(false);

  async function deleteTransaction(): Promise<void> {
    setErrorMessage('');

    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteFetcher(`/transactions/${transaction.id}`);
      await mutateOnDelete();
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

  return (
    <div className="grid grid-cols-4 border-b-2 border-[var(--ctp-surface1)] text-lg">
      {isEditOpen && (
        <button
          className="fixed inset-0 z-40 bg-[var(--ctp-crust)]/25 backdrop-blur-xs transition-opacity"
          onClick={onEditOrClose}
        />
      )}
      <div className="flex items-center justify-start gap-2">
        <BiEdit
          className="cursor-pointer text-[var(--ctp-subtext1)] transition-colors duration-500 hover:text-[var(--ctp-subtext0)]"
          size={22}
          onClick={onEditOrClose}
        />
        <span className="truncate">
          {transaction.category.name}{' '}
          {describeInstallments(transaction, selectedDate)}
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
      <div className="truncate">{transaction.notes}</div>
      <div className="truncate">{getDate()}</div>
      <div className="flex items-center justify-end gap-1">
        <Money className="truncate" value={calculateInstallmentAmount} />
        {errorMessage && (
          <span className="truncate text-xs text-[var(--ctp-red)]">
            {errorMessage}
          </span>
        )}
        {isConfirmingDelete && (
          <div className="flex items-center gap-1">
            <button
              className="cursor-pointer rounded bg-[var(--ctp-red)]/25 px-2 py-1 text-xs font-semibold text-[var(--ctp-red)]"
              disabled={isDeleting}
              onClick={deleteTransaction}
              type="button"
            >
              {isDeleting ? t.common.deleting : t.common.confirm}
            </button>
            <button
              className="cursor-pointer rounded bg-[var(--ctp-surface1)] px-2 py-1 text-xs font-semibold text-[var(--ctp-text)] hover:bg-[var(--ctp-surface2)]"
              disabled={isDeleting}
              onClick={(): void => setIsConfirmingDelete(false)}
              type="button"
            >
              {t.common.cancel}
            </button>
          </div>
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
      <div
        className={clsx(
          'fixed top-0 right-0 z-50 h-full w-[400px] transform bg-[var(--ctp-mantle)] shadow-lg transition-transform duration-300 md:w-[500px]',
          isEditOpen
            ? 'pointer-events-auto translate-x-0'
            : 'pointer-events-none translate-x-full'
        )}
      >
        <NewTransaction onClose={onEditOrClose} transaction={transaction} />
      </div>
      {isPrepaying && (
        <InstallmentPrepayment
          transaction={transaction}
          onChanged={mutateOnDelete}
          onClose={(): void => setIsPrepaying(false)}
        />
      )}
    </div>
  );
}
