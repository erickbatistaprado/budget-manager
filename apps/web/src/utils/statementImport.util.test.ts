import type { StatementPreviewLine } from '@budget-manager/api-client';
import {
  applyCategory,
  describeStatus,
  formatStatementDate,
  summarize,
  toImportLines,
  type ImportRow,
} from './statementImport.util';

function line(overrides: Partial<StatementPreviewLine>): StatementPreviewLine {
  return {
    index: 0,
    date: '2026/11/14',
    description: 'Corner Market',
    amount: 50,
    credit: false,
    installmentNumber: null,
    installmentTotal: null,
    cardholder: null,
    suggestedCategoryId: null,
    duplicate: false,
    duplicateOfTransactionId: null,
    duplicateOfLine: null,
    selected: true,
    ...overrides,
  };
}

const rows: ImportRow[] = [
  { line: line({ index: 0 }), selected: true, categoryId: 'groceries' },
  {
    line: line({
      index: 1,
      description: 'Bike Shop',
      amount: 100,
      installmentNumber: 2,
      installmentTotal: 3,
    }),
    selected: true,
    categoryId: '',
  },
  {
    line: line({ index: 2, credit: true, amount: 20, selected: false }),
    selected: false,
    categoryId: '',
  },
  {
    line: line({
      index: 3,
      duplicate: true,
      duplicateOfTransactionId: 'saved',
      selected: false,
    }),
    selected: false,
    categoryId: 'groceries',
  },
];

describe('statement import helpers', (): void => {
  it('summarizes what will be imported', (): void => {
    expect(summarize(rows)).toEqual({
      total: 4,
      selected: 2,
      duplicates: 1,
      credits: 1,
      missingCategory: 1,
      selectedAmount: 150,
    });
  });

  it('sends only selected rows that have a category', (): void => {
    expect(toImportLines(rows)).toEqual([
      {
        date: '2026/11/14',
        description: 'Corner Market',
        amount: 50,
        credit: false,
        installmentNumber: null,
        installmentTotal: null,
        categoryId: 'groceries',
      },
    ]);
  });

  it('applies a category to selected rows of the same kind only', (): void => {
    const updated: ImportRow[] = applyCategory(rows, 'shopping', false);

    expect(updated.map((row: ImportRow): string => row.categoryId)).toEqual([
      'shopping',
      'shopping',
      '',
      'groceries',
    ]);
  });

  it('formats dates and statuses for people', (): void => {
    expect(formatStatementDate('2026/11/14')).toBe('14/11/2026');
    expect(describeStatus(rows[3]!.line)).toBe('Already imported');
    expect(describeStatus(line({ duplicate: true, duplicateOfLine: 4 }))).toBe(
      'Same purchase as line 5'
    );
    expect(describeStatus(rows[2]!.line)).toBe('Credit');
    expect(describeStatus(rows[0]!.line)).toBe('New');
  });
});
