import type { InvestmentType, SavingLocation } from '@/enums';

export interface Saving {
  investmentType?: InvestmentType | null;
  updatedAt?: string;
  id: string;
  name: string;
  amount: number;
  invested?: number;
  gain?: number;
  location: SavingLocation;
}
