import type { RepeatInterval } from '@/enums';
import type { Category, Installment } from '@/types';

export interface Transaction {
  id: string;
  category: Category;
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
