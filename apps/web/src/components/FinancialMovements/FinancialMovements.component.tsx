'use client';
import {
  DismissOverlay,
  Button,
  IconButton,
  Panel,
  Badge,
  EntryRow,
  SidePanel,
} from '@/components/ui';
import Link from 'next/link';

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
import { useMemo, useState, type JSX } from 'react';
import { BiEdit } from 'react-icons/bi';
import { FcFullTrash } from 'react-icons/fc';
import { FiFastForward } from 'react-icons/fi';

export interface FinancialMovementsProps {
  table?: boolean;
  transaction: Transaction;
  selectedDate: Date;
}

export default function FinancialMovements({
  transaction,
  selectedDate,
  table = false,
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
  const displayedNotes = occurrence ? occurrence.notes : transaction.notes;
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

  const Container = table ? 'tbody' : 'div';
  const ExtraRow = table ? 'tr' : 'div';
  const ExtraCell = table ? 'td' : 'div';
  return (
    <Container className="min-w-0">
      <EntryRow
        table={table}
        icon={transaction.category.transactionType === 'INCOME' ? '↗' : '↙'}
        description={
          transaction.financingId ? (
            <Link
              className="underline"
              href={`/financings/${transaction.financingId}`}
            >
              {transaction.notes || t.financing.title}
            </Link>
          ) : (
            displayedNotes || transaction.category.name
          )
        }
        detail={
          <>
            {transaction.category.name}{' '}
            {describeInstallments(transaction, selectedDate)}
            {occurrence?.changed && (
              <span className="ml-1 text-xs">
                {t.transactions.changedThisMonth}
              </span>
            )}
            {paidEarlyThisMonth && <Badge>{t.transactions.paidEarly}</Badge>}
          </>
        }
        date={
          <>
            {getDate()}
            <span className="block text-xs text-[var(--ctp-subtext0)]">
              {paymentLabel(transaction, t.payments.methods)}
            </span>
            {transaction.billDueDate && (
              <Badge>
                {t.cards.billMonth(
                  parseApiDate(transaction.billDueDate)
                    .toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
                      month: 'short',
                    })
                    .replace('.', '')
                )}
              </Badge>
            )}
            {transaction.card && transaction.installmentNumbers && (
              <span className="block text-xs">
                {formatDate(transaction.date, language)}
              </span>
            )}
          </>
        }
        amount={<Money value={calculateInstallmentAmount} />}
        actions={
          <>
            <IconButton
              variant="ghost"
              disabled={Boolean(transaction.financingId)}
              aria-label={t.transactions.editAriaLabel}
              onClick={onEditOrClose}
            >
              <BiEdit size={20} />
            </IconButton>
            {Boolean(transaction.installmentNumbers) &&
              !transaction.financingId && (
                <IconButton
                  variant="ghost"
                  aria-label={t.transactions.payInstallmentsEarly}
                  onClick={(): void => setIsPrepaying(!isPrepaying)}
                >
                  <FiFastForward size={18} />
                </IconButton>
              )}
            {!isConfirmingDelete && !transaction.financingId && (
              <IconButton
                variant="ghost"
                aria-label={t.transactions.deleteAriaLabel}
                disabled={isDeleting}
                onClick={(): void => {
                  void deleteTransaction();
                }}
              >
                <FcFullTrash size={20} />
              </IconButton>
            )}
          </>
        }
      />
      {(isEditOpen ||
        isConfirmingDelete ||
        Boolean(errorMessage) ||
        isPrepaying) && (
        <ExtraRow>
          <ExtraCell colSpan={table ? 5 : undefined}>
            {isEditOpen && (
              <DismissOverlay
                aria-label={t.common.cancel}

                onClick={onEditOrClose}
              />
            )}
            {errorMessage && (
              <p role="alert" className="text-xs text-[var(--ctp-red)]">
                {errorMessage}
              </p>
            )}
            {isConfirmingDelete && (
              <Panel className="col-span-2 mb-2 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm sm:col-span-4">
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
                  {isDeleting && (
                    <span className="text-xs">{t.common.deleting}</span>
                  )}
                  {!isDeleting && !monthly && (
                    <Button
                      variant="danger"
                      onClick={(): void => {
                        void deleteTransaction('month');
                      }}
                      type="button"
                    >
                      {t.common.delete}
                    </Button>
                  )}
                  {!isDeleting && monthly && (
                    <>
                      <Button
                        variant="danger"
                        onClick={(): void => {
                          void deleteTransaction('month');
                        }}
                        type="button"
                      >
                        {t.transactions.onlyMonth(monthLabel)}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={(): void => {
                          void deleteTransaction('following');
                        }}
                        type="button"
                      >
                        {t.transactions.fromMonth(monthLabel)}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="secondary"
                    disabled={isDeleting}
                    onClick={(): void => setIsConfirmingDelete(false)}
                    type="button"
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              </Panel>
            )}
            {isEditOpen && (
              <SidePanel title={t.common.edit} onClose={onEditOrClose}>
                <NewTransaction
                  onClose={onEditOrClose}
                  transaction={transaction}
                  selectedDate={selectedDate}
                />
              </SidePanel>
            )}
            {isPrepaying && (
              <InstallmentPrepayment
                transaction={transaction}
                onChanged={refreshTransactions}
                onClose={(): void => setIsPrepaying(false)}
              />
            )}
          </ExtraCell>
        </ExtraRow>
      )}
    </Container>
  );
}
