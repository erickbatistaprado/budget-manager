'use client';

import { DateField, Button, Select, Field } from '@/components/ui';

import MovementForm from '@/components/MoneyFlow/MovementForm';
import { Input, SelectWithTooltip } from '@/components';
import { RepeatInterval, TransactionType } from '@/enums';
import { useCategories } from '@/hooks';
import useCards from '@/hooks/useCards.hook';
import useAccounts from '@/hooks/useAccounts.hook';
import { PaymentMethod } from '@budget-manager/api-client';
import { supportsAccount } from '@/utils/payment.util';
import { cardBillDueDate } from '@/utils/cardBill.util';
import { useI18n } from '@/i18n/useI18n';
import { refreshTransactions } from '@/libs/transactionsCache.lib';
import { postFetcher, putFetcher } from '@/libs/fetchers.lib';
import type { Category, Transaction } from '@/types';
import {
  formatDate,
  getApiDate,
  parseApiDate,
} from '@/utils/globalFormats.util';
import { monthlyOccurrence, monthKey } from '@/utils/monthlyTransaction.util';
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
  const [movement, setMovement] = useState(false);
  const { data: cards } = useCards();
  const { data: accounts } = useAccounts();
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
      paymentMethod: form.paymentMethod || null,
      accountId: supportsAccount(
        form.paymentMethod,
        transactionType === TransactionType.INCOME
      )
        ? (form.accountId ?? form.account?.id ?? null) || null
        : null,
      cardId:
        isCardEnabled && form.paymentMethod === PaymentMethod.CREDIT_CARD
          ? (form.cardId ?? form.card?.id ?? null) || null
          : null,
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
    if (
      name === 'repeats' &&
      value !== RepeatInterval.NONE &&
      value !== RepeatInterval.MONTHLY &&
      form.paymentMethod === PaymentMethod.CREDIT_CARD
    ) {
      setForm((previous): Partial<Transaction> => ({
        ...previous,
        repeats: value as RepeatInterval,
        paymentMethod: null,
        cardId: null,
        card: null,
      }));
      return;
    }
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
      paymentMethod: null,
      cardId: null,
      card: null,
      accountId: null,
      account: null,
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
  const repeatsMonthly: boolean = form.repeats === RepeatInterval.MONTHLY;
  const isCardEnabled: boolean =
    transactionType === TransactionType.EXPENSE &&
    (form.repeats === RepeatInterval.NONE || repeatsMonthly);
  const selectedCard = cards?.find(
    (card): boolean => card.id === (form.cardId ?? form.card?.id)
  );
  const billDate =
    selectedCard && date ? cardBillDueDate(date, selectedCard) : undefined;
  const totalValue: number = Number(form.totalValue);
  const isSaveDisabled: boolean = Boolean(
    !Number.isFinite(totalValue) || totalValue <= 0 || !form.category?.id
  );

  if (monthly && !scope) {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-5 bg-[var(--ctp-surface0)]/55 p-5 text-[var(--ctp-text)] backdrop-blur-xs">
        <div className="flex flex-col gap-1">
          <MdEventRepeat className="text-[var(--ctp-yellow)]" size={25} />
          <h2 className="text-lg font-semibold">
            {t.transactions.monthlyScopeTitle}
          </h2>
          <p className="text-sm text-[var(--ctp-subtext1)]">
            {transaction?.notes || transaction?.category?.name}
          </p>
        </div>
        {(
          [
            [
              'month',
              t.transactions.onlyMonth(monthLabel),
              t.transactions.onlyMonthHint,
            ],
            [
              'following',
              t.transactions.fromMonth(monthLabel),
              t.transactions.fromMonthHint,
            ],
          ] as const
        ).map(([value, label, hint]): JSX.Element => (
          <Button
            variant="secondary"
            key={value}
            type="button"
            onClick={(): void => setScope(value)}
            aria-label={label}
            aria-describedby={`${fieldId}-${value}-hint`}
            className="flex w-full flex-col items-start gap-1 text-left"
          >
            <span className="font-semibold">{label}</span>
            <span
              id={`${fieldId}-${value}-hint`}
              className="text-sm text-[var(--ctp-subtext1)]"
            >
              {hint}
            </span>
          </Button>
        ))}
        <p className="text-sm text-[var(--ctp-subtext0)]">
          {t.transactions.earlierUnchanged}
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          type="button"
          onClick={onClose}
        >
          {t.common.cancel}
        </Button>
      </div>
    );
  }
  if (movement)
    return (
      <div className="w-full p-5">
        <MovementForm onClose={onClose} variant="drawer" />
      </div>
    );

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--ctp-surface0)]/55 p-5 text-[var(--ctp-text)] backdrop-blur-xs">
      <div className="flex w-full items-center justify-center">
        {date ? (
          <DateField
            form={`${fieldId}-form`}
            required
            label={language === 'pt' ? 'Data' : 'Date'}
            value={date}
            onChange={(value): void => {
              if (value) setDate(value);
            }}
          />
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
          onChange={(event): void => {
            if (event.target.value === 'MOVEMENT') setMovement(true);
            else handleTransactionTypeChange(event);
          }}
          options={[
            { label: t.transactions.selectType, value: '' },
            { label: t.common.expense, value: 'EXPENSE' },
            { label: t.common.income, value: 'INCOME' },
            ...(!transaction
              ? [{ label: t.moneyFlow.title, value: 'MOVEMENT' }]
              : []),
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
        <Field
          label={
            transactionType === TransactionType.INCOME
              ? t.payments.receivedBy
              : t.payments.method
          }
        >
          <Select
            value={form.paymentMethod ?? ''}
            disabled={monthly && scope === 'month'}
            onChange={(event): void => {
              const paymentMethod = event.currentTarget.value as
                PaymentMethod | '';
              setForm((previous): Partial<Transaction> => ({
                ...previous,
                paymentMethod: paymentMethod || null,
                cardId: null,
                card: null,
                accountId: null,
                account: null,
              }));
            }}
          >
            <option value="">{t.payments.notSet}</option>
            {Object.values(PaymentMethod)
              .filter((method): boolean => {
                if (transactionType === TransactionType.INCOME) {
                  return [
                    PaymentMethod.PIX,
                    PaymentMethod.BANK_TRANSFER,
                    PaymentMethod.CASH,
                    PaymentMethod.OTHER,
                  ].includes(method);
                }
                return isCardEnabled || method !== PaymentMethod.CREDIT_CARD;
              })
              .map((method): JSX.Element => (
                <option key={method} value={method}>
                  {t.payments.methods[method]}
                </option>
              ))}
          </Select>
        </Field>
        {supportsAccount(
          form.paymentMethod,
          transactionType === TransactionType.INCOME
        ) && (
          <Field label={t.payments.account}>
            <Select
              name="accountId"
              disabled={monthly && scope === 'month'}
              value={form.accountId ?? form.account?.id ?? ''}
              onChange={handleChange}
            >
              <option value="">{t.payments.notSet}</option>
              {accounts?.map((account): JSX.Element => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {isCardEnabled && form.paymentMethod === PaymentMethod.CREDIT_CARD && (
          <div>
            <Select
              label={t.cards.card}
              id={`${fieldId}-card`}
              name="cardId"
              required
              value={form.cardId ?? form.card?.id ?? ''}
              onChange={handleChange}
            >
              <option value="">{t.cards.selectCard}</option>
              {cards?.map((card): JSX.Element => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </Select>
            {repeatsMonthly && (
              <p className="text-sm text-[var(--ctp-subtext1)]">
                {t.cards.monthlyBill}
              </p>
            )}
            {!repeatsMonthly && billDate && (
              <p className="text-sm text-[var(--ctp-subtext1)]">
                {t.cards.billDue(formatDate(billDate, language))}
              </p>
            )}
          </div>
        )}
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
          <Input
            startAdornment={<FcSurvey size={25} />}
            id={`${fieldId}-notes`}
            name="notes"
            label={t.common.notes}
            type="text"
            value={form.notes ?? ''}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Input
            startAdornment={<FcCurrencyExchange size={25} />}
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
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            type="button"
            onClick={handleOnClose}
          >
            {t.common.cancel}
          </Button>
          <Button
            className="w-full"
            variant="primary"
            size="lg"
            type="submit"
            disabled={isSaveDisabled || isSubmitting}
          >
            {isSubmitting ? t.common.saving : t.common.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
