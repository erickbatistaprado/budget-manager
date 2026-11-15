import {
  InvestmentType,
  RepeatInterval,
  SavingLocation,
  TransactionType,
} from '@/enums';
import type { Saving, Transaction } from '@/types';
import {
  investmentAllocation,
  investmentGroups,
  emergencyRunway,
  isSavingStale,
  savingUpdatedDate,
  savingsAllocation,
  savingsHistoryRange,
  savingsShare,
  selectSavings,
} from './savings.util';

const today = new Date(2026, 10, 14, 12);
function saving(overrides: Partial<Saving> = {}): Saving {
  return {
    id: 'reserve',
    name: 'Reserva',
    amount: 100,
    location: SavingLocation.CASH,
    ...overrides,
  };
}
function expense(date: string, totalValue: number): Transaction {
  return {
    id: date,
    category: {
      id: 'food',
      name: 'Food',
      transactionType: TransactionType.EXPENSE,
    },
    date,
    totalValue,
    repeats: RepeatInterval.NONE,
  };
}
describe('emergency runway', (): void => {
  it('cannot be calculated without expenses', (): void => {
    expect(emergencyRunway(1000, [], today)).toBeNull();
  });
  it('averages only expense months in the last three full months', (): void => {
    const expenses = [
      expense('2026/08/01', 100),
      expense('2026/08/31', 100),
      expense('2026/10/31', 400),
      expense('2026/11/01', 9000),
      expense('2026/07/31', 9000),
    ];
    expect(emergencyRunway(1200, expenses, today)).toBe(4);
    expect(emergencyRunway(0, expenses, today)).toBe(0);
  });
  it('projects recurring expenses and averages all three active months', (): void => {
    const recurring = {
      ...expense('2026/07/15', 200),
      repeats: RepeatInterval.MONTHLY,
    };
    expect(emergencyRunway(1200, [recurring], today)).toBe(6);
    expect(savingsHistoryRange(today)).toEqual({
      startDate: new Date(2026, 7, 1),
      endDate: new Date(2026, 9, 31),
    });
  });
});
describe('allocation', (): void => {
  it('keeps liquid, invested and other distinct and calculates shares', (): void => {
    const data = savingsAllocation(
      Object.values(SavingLocation).map((location): Saving =>
        saving({ location })
      )
    );
    expect(data.total).toBe(500);
    expect(data.liquid).toBe(300);
    expect(data.invested).toBe(100);
    expect(data.other).toBe(100);
    expect(data.locations.every((item): boolean => item.share === 20)).toBe(
      true
    );
    expect(savingsShare(0, 0)).toBe(0);
    expect(savingsAllocation([]).total).toBe(0);
  });
});
describe('entry selection', (): void => {
  const entries = [
    saving({
      id: 'older',
      name: 'Árvore',
      amount: 10,
      updatedAt: '2026-08-01T12:00:00Z',
    }),
    saving({
      id: 'newer',
      name: 'Banco',
      amount: 20,
      location: SavingLocation.INVESTMENT,
      updatedAt: '2026-11-01T12:00:00Z',
    }),
    saving({ id: 'unknown', name: 'Casa', amount: 0 }),
  ];
  it('searches without accents or case and combines location filtering', (): void => {
    expect(
      selectSavings(entries, ' ARVORE ', SavingLocation.CASH, 'amount', 'pt')
    ).toEqual([entries[0]]);
    expect(
      selectSavings(
        entries,
        'arvore',
        SavingLocation.INVESTMENT,
        'amount',
        'pt'
      )
    ).toEqual([]);
  });
  it.each(['amount', 'updated'] as const)(
    'sorts %s descending without mutating input',
    (sort): void => {
      expect(
        selectSavings(entries, '', null, sort, 'en').map(
          (entry): string => entry.id
        )
      ).toEqual(['newer', 'older', 'unknown']);
      expect(entries[0].id).toBe('older');
    }
  );
  it('sorts names by language', (): void => {
    expect(selectSavings(entries, '', null, 'name', 'pt')).toEqual(entries);
  });
});
describe('balance age', (): void => {
  it('requires more than 90 full days and handles unknown and future dates', (): void => {
    expect(
      isSavingStale(saving({ updatedAt: '2026-08-16T12:00:00' }), today)
    ).toBe(false);
    expect(
      isSavingStale(saving({ updatedAt: '2026-08-15T12:00:00' }), today)
    ).toBe(true);
    expect(isSavingStale(saving(), today)).toBe(false);
    expect(
      isSavingStale(saving({ updatedAt: '2027-01-01T12:00:00' }), today)
    ).toBe(false);
    expect(savingUpdatedDate(saving({ updatedAt: 'invalid' }))).toBeNull();
  });
});

describe('investment allocation', (): void => {
  it('groups every type once and totals repeated entries against the invested total', (): void => {
    expect(Object.values(investmentGroups).flat().sort()).toEqual(
      Object.values(InvestmentType).sort()
    );
    const investments = Object.values(InvestmentType).map(
      (investmentType): Saving =>
        saving({
          location: SavingLocation.INVESTMENT,
          investmentType,
          amount: 10,
        })
    );
    const result = investmentAllocation([
      ...investments,
      saving({
        location: SavingLocation.INVESTMENT,
        investmentType: InvestmentType.CDB,
        amount: 10,
      }),
      saving({ amount: 500 }),
    ]);
    expect(result.total).toBe(140);
    expect(result.groups.map((item): number => item.amount)).toEqual([
      50, 50, 20, 20,
    ]);
    expect(result.groups.map((item): number => item.share)).toEqual(
      [50, 50, 20, 20].map((amount): number => (amount / 140) * 100)
    );
    expect(result.types[0]).toEqual({
      type: InvestmentType.CDB,
      amount: 20,
      share: (20 / 140) * 100,
    });
    expect(
      result.types
        .slice(1)
        .every(
          (item): boolean =>
            item.amount === 10 && item.share === (10 / 140) * 100
        )
    ).toBe(true);
    expect(
      investmentAllocation([]).groups.every(
        (item): boolean => item.amount === 0 && item.share === 0
      )
    ).toBe(true);
  });
  it('combines the type filter with location and search', (): void => {
    const entries = [
      saving({
        name: 'Bank',
        location: SavingLocation.INVESTMENT,
        investmentType: InvestmentType.CDB,
      }),
      saving({
        name: 'Shares',
        location: SavingLocation.INVESTMENT,
        investmentType: InvestmentType.STOCKS,
      }),
      saving(),
    ];
    expect(
      selectSavings(
        entries,
        'bank',
        SavingLocation.INVESTMENT,
        'amount',
        'en',
        InvestmentType.CDB
      )
    ).toEqual([entries[0]]);
    expect(
      selectSavings(
        entries,
        'shares',
        SavingLocation.INVESTMENT,
        'amount',
        'en',
        InvestmentType.CDB
      )
    ).toEqual([]);
    expect(
      selectSavings(
        entries,
        '',
        SavingLocation.CASH,
        'amount',
        'en',
        InvestmentType.CDB
      )
    ).toEqual([entries[2]]);
  });
});
