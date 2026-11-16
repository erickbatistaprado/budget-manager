'use client';

import { MonthSwitcher, Panel } from '@/components/ui';

import { Money } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '@/types';
import { amountInMonth } from '@/utils/installments.util';
import { useMemo, type Dispatch, type JSX, type SetStateAction } from 'react';
import { FcBearish, FcBullish } from 'react-icons/fc';

function getTransactionAmount(transaction: Transaction, date: Date): number {
  return amountInMonth(transaction, date);
}

function total(transactions: Transaction[], date: Date): number {
  return transactions.reduce(
    (sum: number, transaction: Transaction): number =>
      sum + getTransactionAmount(transaction, date),
    0
  );
}

interface BalanceProps {
  expenses: Transaction[];
  incomes: Transaction[];
  date: Date;
  setDate: Dispatch<SetStateAction<Date>>;
}

export default function Balance({
  expenses,
  incomes,
  date,
  setDate,
}: Readonly<BalanceProps>): JSX.Element {
  const { t } = useI18n();
  const totalIncomes: number = useMemo(
    (): number => total(incomes, date),
    [date, incomes]
  );
  const totalExpenses: number = useMemo(
    (): number => total(expenses, date),
    [date, expenses]
  );

  return (
    <Panel className="flex w-full cursor-default flex-col justify-between gap-2 shadow-md">
      <div className="flex w-full justify-between">
        <div>
          <span className="text-2xl">{t.home.total}</span>
          <Money
            className="text-left text-3xl"
            value={totalIncomes - totalExpenses}
          />
        </div>
        <div className="flex items-center">
          <MonthSwitcher value={date} onChange={setDate} />
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <div className="text-left">
          <span className="text-xl">{t.home.expenses}</span>
          <div className="flex items-end gap-1">
            <FcBearish size={35} />
            <Money className="text-xl" value={totalExpenses} />
          </div>
        </div>
        <div className="flex gap-1">
          <div className="text-end">
            <span className="text-xl">{t.home.incomes}</span>
            <div className="flex items-end justify-end gap-1">
              <Money className="text-xl" value={totalIncomes} />
              <FcBullish size={35} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
