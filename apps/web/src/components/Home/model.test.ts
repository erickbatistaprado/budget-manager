import {
  filterEntries,
  filteredTotals,
  type Entry,
  type Filters,
} from './model';
const filters: Filters = {
  search: '',
  type: 'all',
  category: '',
  payment: '',
  unassigned: false,
};
const entries: Entry[] = [
  {
    key: 'first',
    type: 'income',
    amount: 10,
    date: new Date(2026, 0, 10).getTime(),
    category: 'Alpha',
    payment: ['Cash'],
    search: 'Alpha',
    description: 'Alpha',
    unassigned: false,
  },
  {
    key: 'second',
    type: 'movements',
    amount: 20,
    date: new Date(2026, 0, 20).getTime(),
    category: 'Beta',
    payment: ['Debit'],
    search: 'Beta',
    description: 'Beta',
    unassigned: false,
  },
];
it.each(['date', 'amount', 'description', 'category', 'payment'] as const)(
  'sorts %s in both directions',
  (sort): void => {
    expect(
      filterEntries(entries, { ...filters, sort, direction: 'asc' }).map(
        (entry): string => entry.key
      )
    ).toEqual(['first', 'second']);
    expect(
      filterEntries(entries, { ...filters, sort, direction: 'desc' }).map(
        (entry): string => entry.key
      )
    ).toEqual(['second', 'first']);
  }
);
it('filters inclusive values and dates, retaining totals over the whole set', (): void => {
  expect(
    filterEntries(entries, {
      ...filters,
      minimum: '10',
      maximum: '20',
      from: '2026-01-10',
      until: '2026-01-20',
    })
  ).toHaveLength(2);
  const selected = filterEntries(entries, {
    ...filters,
    minimum: '20',
    maximum: '20',
  });
  expect(selected.map((entry): string => entry.key)).toEqual(['second']);
  expect(filteredTotals(selected)).toEqual({
    income: 0,
    expenses: 0,
    movements: 20,
  });
  expect(
    filterEntries(entries, {
      ...filters,
      from: '2026-01-11',
      until: '2026-01-19',
    })
  ).toHaveLength(0);
});
