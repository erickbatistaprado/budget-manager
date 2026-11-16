import { RepeatInterval, TransactionType } from '@/enums';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { en } from '@/i18n/messages/en';
import { pt } from '@/i18n/messages/pt';
import type {
  Evolution,
  MonthOverview,
  Movement,
} from '@budget-manager/api-client';
import {
  filterEntries,
  filteredTotals,
  investmentDraft,
  evolutionData,
  accountOutflows,
  type Entry,
} from './model';
import MonthSummary from './MonthSummary';
import MovementRow from './MovementRow';
import EntryList from './EntryList';
jest.mock('@/components', (): object => ({
  FinancialMovements: (): null => null,
}));
const overview: MonthOverview = {
  month: '2026-02',
  incomes: 1000,
  expenses: 600,
  surplus: 400,
  invested: 100,
  kept: 300,
  accounts: [],
  bills: [],
  unassigned: { count: 0, total: 0 },
};
const movement: Movement = {
  id: null,
  kind: 'CARD_BILL_PAYMENT',
  date: '2026/02/10',
  amount: 200,
  automatic: true,
  opening: false,
  fromAccountId: 'bank',
  cardId: 'card',
  billDueDate: '2026/02/10',
};
const entries: Entry[] = Array.from({ length: 65 }, (unused, index): Entry => ({
  key: String(index),
  type: index === 0 ? 'income' : 'expenses',
  amount: 10,
  date: index,
  search: index === 0 ? 'Salary bank' : 'Food Visa note',
  category: index === 0 ? 'Salary' : 'Food',
  payment: index === 0 ? ['bank'] : ['Visa'],
  unassigned: index === 64,
}));
it('filters across the whole month and totals beyond the first page', (): void => {
  const filters = {
    search: 'visa NOTE',
    type: 'all',
    category: '',
    payment: '',
    unassigned: false,
  };
  expect(filteredTotals(filterEntries(entries, filters))).toEqual({
    income: 0,
    expenses: 640,
    movements: 0,
  });
  expect(filterEntries(entries, { ...filters, unassigned: true })).toHaveLength(
    1
  );
  expect(filterEntries(entries, { ...filters, type: 'income' })).toHaveLength(
    0
  );
  expect(
    filterEntries(entries, { ...filters, category: 'Food', payment: 'Visa' })
  ).toHaveLength(64);
  expect(filterEntries(entries, { ...filters, payment: 'bank' })).toHaveLength(
    0
  );
});
it('maps negative surplus and invested without changing net worth and limits the window', (): void => {
  const rows: Evolution[] = Array.from(
    { length: 14 },
    (unused, index): Evolution => ({
      month: `2025-${index}`,
      incomes: 0,
      expenses: 10,
      surplus: -10,
      invested: 5,
      accounts: 1,
      savings: 2,
      debt: 4,
      netWorth: -1,
    })
  );
  expect(evolutionData(rows, false).months).toHaveLength(12);
  expect(evolutionData(rows, true).months).toHaveLength(14);
  expect(evolutionData(rows, false).negative[0]).toBe(-10);
  expect(evolutionData(rows, false).positive[0]).toBe(0);
  expect(evolutionData(rows, false).invested[0]).toBe(5);
  expect(evolutionData(rows, false).netWorth[0]).toBe(-1);
});
it('prefills the highest income account and clamps the investment date', (): void => {
  expect(
    investmentDraft(300, [], new Date(2026, 1, 1), new Date(2026, 2, 1))
  ).toMatchObject({ amount: 300, kind: 'INVESTMENT', date: '2026/02/28' });
  expect(
    investmentDraft(300, [], new Date(2026, 1, 1), new Date(2026, 1, 15)).date
  ).toBe('2026/02/15');
});
it('attributes account cash outflows including movements', (): void => {
  expect(accountOutflows([{ ...entries[1], movement }])).toEqual({ bank: 10 });
});
it.each(['en', 'pt'] as const)(
  'renders summary states and actions in %s',
  (language): void => {
    const labels = language === 'pt' ? pt.dashboard : en.dashboard;
    const invest = jest.fn();
    const view = renderWithI18n(
      <MonthSummary
        overview={overview}
        incomes={[]}
        month={new Date(2026, 1, 1)}
        onInvest={invest}
      />,
      { language }
    );
    fireEvent.click(screen.getByRole('button', { name: labels.invest }));
    expect(invest).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'INVESTMENT',
        amount: 300,
        date: '2026/02/28',
      })
    );
    view.rerender(
      <MonthSummary
        overview={{ ...overview, surplus: 0, kept: 0 }}
        incomes={[]}
        month={new Date(2026, 1, 1)}
        onInvest={invest}
      />
    );
    expect(
      screen.queryByRole('button', { name: labels.invest })
    ).not.toBeInTheDocument();
    view.rerender(
      <MonthSummary
        overview={{ ...overview, expenses: 1050, surplus: -50, kept: -50 }}
        incomes={[]}
        month={new Date(2026, 1, 1)}
        onInvest={invest}
      />
    );
    expect(screen.getByText(new RegExp(labels.shortfall))).toBeInTheDocument();
  }
);
it.each(['en', 'pt'] as const)(
  'shows automatic movements and registers the payment in %s',
  (language): void => {
    const labels = language === 'pt' ? pt : en;
    const record = jest.fn();
    renderWithI18n(
      <MovementRow
        movement={movement}
        names={{ bank: 'Nubank', card: 'Visa' }}
        onRecord={record}
      />,
      { language }
    );
    expect(screen.getByText(labels.moneyFlow.automatic)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: labels.common.delete })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: labels.dashboard.record })
    );
    expect(record).toHaveBeenCalledWith(movement);
  }
);
it.each(['en', 'pt'] as const)(
  'searches and filters the unified list in %s',
  (language): void => {
    const labels = language === 'pt' ? pt.dashboard : en.dashboard;
    renderWithI18n(
      <EntryList
        entries={entries}
        month={new Date(2026, 1, 1)}
        names={{}}
        unassigned={false}
        onUnassigned={jest.fn()}
        onRecord={jest.fn()}
        loading={false}
      />,
      { language }
    );
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'visa' },
    });
    expect(screen.getByText(/\(64\)/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Filtros' : 'Filters',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: labels.income }));
    expect(screen.getByText(/\(0\)/)).toBeInTheDocument();
  }
);

it('uses the account with the greatest complete monthly income', (): void => {
  const incomeEntries: Entry[] = [
    {
      ...entries[0],
      amount: 200,
      transaction: {
        id: 'salary',
        category: {
          id: 'salary-category',
          name: 'Salary',
          transactionType: TransactionType.INCOME,
        },
        accountId: 'primary',
        totalValue: 200,
        repeats: RepeatInterval.NONE,
        date: '2026/02/01',
      },
    },
    {
      ...entries[0],
      amount: 300,
      transaction: {
        id: 'bonus',
        category: {
          id: 'bonus-category',
          name: 'Bonus',
          transactionType: TransactionType.INCOME,
        },
        accountId: 'other',
        totalValue: 300,
        repeats: RepeatInterval.NONE,
        date: '2026/02/01',
      },
    },
    {
      ...entries[0],
      amount: 200,
      transaction: {
        id: 'extra',
        category: {
          id: 'salary-category',
          name: 'Salary',
          transactionType: TransactionType.INCOME,
        },
        accountId: 'primary',
        totalValue: 200,
        repeats: RepeatInterval.NONE,
        date: '2026/02/01',
      },
    },
  ];
  expect(
    investmentDraft(
      100,
      incomeEntries,
      new Date(2026, 1, 1),
      new Date(2026, 2, 1)
    ).fromAccountId
  ).toBe('primary');
});

it.each(['en', 'pt'] as const)(
  'describes income allocation in %s',
  (language): void => {
    const labels = language === 'pt' ? pt.dashboard : en.dashboard;
    const view = renderWithI18n(
      <MonthSummary
        overview={{ ...overview, invested: 0, kept: 400 }}
        incomes={[]}
        month={new Date(2026, 1, 1)}
        onInvest={jest.fn()}
      />,
      { language }
    );
    function expectWidths(widths: string[]): void {
      // Inspect visual segment widths because they are not separate interactive controls.
      // eslint-disable-next-line testing-library/no-node-access
      const segments = Array.from(screen.getByRole('img').children);
      segments.forEach((segment, index): void =>
        expect(segment).toHaveStyle({ width: widths[index] })
      );
    }
    expectWidths(['60%', '0%', '40%']);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      new RegExp(labels.expenses)
    );
    expect(screen.getByText(new RegExp(labels.kept))).toHaveTextContent('40%');
    view.rerender(
      <MonthSummary
        overview={overview}
        incomes={[]}
        month={new Date(2026, 1, 1)}
        onInvest={jest.fn()}
      />
    );
    expectWidths(['60%', '10%', '30%']);
    expect(screen.getByText(new RegExp(labels.invested))).toHaveTextContent(
      '10%'
    );
    view.rerender(
      <MonthSummary
        overview={{ ...overview, expenses: 1200, surplus: -200, kept: -200 }}
        incomes={[]}
        month={new Date(2026, 1, 1)}
        onInvest={jest.fn()}
      />
    );
    expectWidths(['100%', '0%', '0%']);
    expect(screen.getByText(new RegExp(labels.shortfall))).toHaveTextContent(
      '200'
    );
    expect(screen.queryByText(new RegExp(labels.kept))).not.toBeInTheDocument();
    view.rerender(
      <MonthSummary
        overview={{ ...overview, incomes: 0 }}
        incomes={[]}
        month={new Date(2026, 1, 1)}
        onInvest={jest.fn()}
      />
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(labels.noIncome)).toBeInTheDocument();
  }
);

it.each([false, true])(
  'appends entries and resets filters with observer=%s',
  (observerAvailable): void => {
    const original = globalThis.IntersectionObserver;
    let notify: IntersectionObserverCallback | undefined;
    const observe = jest.fn();
    const disconnect = jest.fn();
    if (observerAvailable) {
      globalThis.IntersectionObserver = jest.fn(
        (callback: IntersectionObserverCallback): IntersectionObserver => {
          notify = callback;
          return {
            observe,
            disconnect,
            unobserve: jest.fn(),
            takeRecords: (): IntersectionObserverEntry[] => [],
            root: null,
            rootMargin: '',
            scrollMargin: '',
            thresholds: [],
          };
        }
      );
    }
    try {
      renderWithI18n(
        <EntryList
          entries={entries}
          month={new Date(2026, 1, 1)}
          names={{}}
          unassigned={false}
          onUnassigned={jest.fn()}
          onRecord={jest.fn()}
          loading={false}
        />
      );
      expect(
        within(screen.getByRole('table')).getAllByRole('row')
      ).toHaveLength(31);
      if (observerAvailable) {
        expect(observe).toHaveBeenCalledWith(
          screen.getByTestId('entries-sentinel')
        );
        act((): void => {
          notify?.(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver
          );
        });
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      }
      expect(
        within(screen.getByRole('table')).getAllByRole('row')
      ).toHaveLength(61);
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'Food' },
      });
      expect(
        within(screen.getByRole('table')).getAllByRole('row')
      ).toHaveLength(31);
      expect(screen.getByText(/\(64\)/)).toBeInTheDocument();
    } finally {
      globalThis.IntersectionObserver = original;
    }
  }
);
