import type { Account, PaymentMethod } from '@budget-manager/api-client';
import type { RepeatInterval } from '@/enums';
import type { Category, Installment } from '@/types';

export interface Transaction {
  id: string;
  category: Category;
  paymentMethod?: PaymentMethod | null;
  accountId?: string | null;
  account?: Account | null;
  cardId?: string | null;
  card?: { id: string; name: string } | null;
  billDueDate?: string | null;
  notes?: string | null;
  totalValue: number;
  installmentNumbers?: number | null;
  installments?: Installment[] | null;
  repeatUntil?: string | null;
  months?:
    | {
        month: string;
        amount?: number | null;
        date?: string | null;
        notes?: string | null;
        skipped: boolean;
      }[]
    | null;
  repeats: RepeatInterval;
  date: string;
}

export interface Page<T> {
  content: T[];
  first: boolean;
  last: boolean;
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type TransactionSortKey = 'category' | 'notes' | 'date' | 'value';
export type TransactionSortOrder = 'asc' | 'desc';
