import type { TransactionType } from '@/enums';

export interface Category {
  id: string;
  name: string;
  fixedCost?: boolean | null;
  transactionType: TransactionType;
}
