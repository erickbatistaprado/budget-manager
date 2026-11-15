import { InvestmentType, SavingLocation } from '@/enums';
import type { Saving, Transaction } from '@/types';
import { addMonths, differenceInDays, isValid, parseISO } from 'date-fns';
import {
  periodRange,
  projectOccurrences,
  savingsSummary,
  sumOccurrences,
  type AnalyticsRange,
} from './analytics.util';

export type SavingsSort = 'amount' | 'name' | 'updated';
export function savingsHistoryRange(today: Date): AnalyticsRange {
  return {
    startDate: periodRange('month', addMonths(today, -3)).startDate,
    endDate: periodRange('month', addMonths(today, -1)).endDate,
  };
}
export function emergencyRunway(
  total: number,
  expenses: Transaction[],
  today: Date
): number | null {
  const occurrences = projectOccurrences(expenses, savingsHistoryRange(today));
  const months = [1, 2, 3]
    .map((offset): number =>
      sumOccurrences(
        occurrences,
        periodRange('month', addMonths(today, -offset))
      )
    )
    .filter((amount): boolean => amount > 0);
  if (!months.length) {
    return null;
  }
  return (
    total /
    (months.reduce((sum, amount): number => sum + amount, 0) / months.length)
  );
}
export function savingsShare(amount: number, total: number): number {
  return total > 0 ? (amount / total) * 100 : 0;
}
export function savingsAllocation(savings: Saving[]): {
  total: number;
  liquid: number;
  invested: number;
  other: number;
  locations: { location: SavingLocation; amount: number; share: number }[];
} {
  const summary = savingsSummary(savings);
  const liquidLocations = [
    SavingLocation.CASH,
    SavingLocation.CHECKING_ACCOUNT,
    SavingLocation.SAVINGS_ACCOUNT,
  ];
  return {
    ...summary,
    liquid: summary.locations
      .filter((item): boolean => liquidLocations.includes(item.location))
      .reduce((sum, item): number => sum + item.amount, 0),
    invested:
      summary.locations.find(
        (item): boolean => item.location === SavingLocation.INVESTMENT
      )?.amount ?? 0,
    other:
      summary.locations.find(
        (item): boolean => item.location === SavingLocation.OTHER
      )?.amount ?? 0,
    locations: summary.locations
      .map(
        (
          item
        ): { location: SavingLocation; amount: number; share: number } => ({
          ...item,
          share: savingsShare(item.amount, summary.total),
        })
      )
      .sort((left, right): number => right.amount - left.amount),
  };
}
export function savingUpdatedDate(saving: Saving): Date | null {
  if (!saving.updatedAt) {
    return null;
  }
  const date = parseISO(saving.updatedAt);
  return isValid(date) ? date : null;
}
export function isSavingStale(saving: Saving, today: Date): boolean {
  const date = savingUpdatedDate(saving);
  return date !== null && differenceInDays(today, date) > 90;
}
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}
export function selectSavings(
  savings: Saving[],
  search: string,
  location: SavingLocation | null,
  sort: SavingsSort,
  language: string,
  investmentType: InvestmentType | null = null
): Saving[] {
  return savings
    .filter(
      (saving): boolean =>
        (!location || saving.location === location) &&
        (location !== SavingLocation.INVESTMENT ||
          !investmentType ||
          saving.investmentType === investmentType) &&
        normalize(saving.name).includes(normalize(search))
    )
    .sort((left, right): number => {
      if (sort === 'name') {
        return left.name.localeCompare(right.name, language);
      }
      if (sort === 'updated') {
        return (
          (savingUpdatedDate(right)?.getTime() ?? 0) -
          (savingUpdatedDate(left)?.getTime() ?? 0)
        );
      }
      return right.amount - left.amount;
    });
}

export const investmentGroups = {
  fixedIncome: [
    InvestmentType.TESOURO_DIRETO,
    InvestmentType.CDB,
    InvestmentType.LCI_LCA,
    InvestmentType.CREDIT_BONDS,
  ],
  variableIncome: [
    InvestmentType.STOCKS,
    InvestmentType.REAL_ESTATE_FUNDS,
    InvestmentType.ETFS,
    InvestmentType.BDRS,
    InvestmentType.CRYPTO,
  ],
  fundsAndPension: [
    InvestmentType.INVESTMENT_FUNDS,
    InvestmentType.PRIVATE_PENSION,
  ],
  other: [InvestmentType.FOREIGN, InvestmentType.OTHER_INVESTMENT],
} satisfies Record<string, InvestmentType[]>;
export type InvestmentGroup = keyof typeof investmentGroups;
export const investmentGroupKeys = Object.keys(
  investmentGroups
) as InvestmentGroup[];
interface InvestmentTotal {
  amount: number;
  share: number;
}
export function investmentAllocation(savings: Saving[]): {
  total: number;
  groups: (InvestmentTotal & { group: InvestmentGroup })[];
  types: (InvestmentTotal & { type: InvestmentType })[];
} {
  const investments = savings.filter(
    (saving): boolean => saving.location === SavingLocation.INVESTMENT
  );
  const total = investments.reduce(
    (sum, saving): number => sum + saving.amount,
    0
  );
  const types = Object.values(InvestmentType)
    .map((type): InvestmentTotal & { type: InvestmentType } => {
      const amount = investments
        .filter((saving): boolean => saving.investmentType === type)
        .reduce((sum, saving): number => sum + saving.amount, 0);
      return { type, amount, share: savingsShare(amount, total) };
    })
    .sort((left, right): number => right.amount - left.amount);
  const groups = investmentGroupKeys.map(
    (group): InvestmentTotal & { group: InvestmentGroup } => {
      const members: InvestmentType[] = investmentGroups[group];
      const amount = types
        .filter((item): boolean => members.includes(item.type))
        .reduce((sum, item): number => sum + item.amount, 0);
      return { group, amount, share: savingsShare(amount, total) };
    }
  );
  return { total, groups, types };
}
