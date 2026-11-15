import type { StatementPreviewLine } from '@budget-manager/api-client';
import {
  applyCategory,
  chooseCategory,
  describeSuggestion,
  describeLineDetails,
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
    paidEarly: false,
    cardholder: null,
    suggestedCategoryId: null,
    suggestionSource: null,
    suggestionBasis: null,
    suggestionCount: 0,
    merchantKey: 'corner market',
    duplicate: false,
    duplicateOfTransactionId: null,
    duplicateOfLine: null,
    samePurchaseAsLine: null,
    samePurchaseAsTransactionId: null,
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
      suggested: 0,
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
        paidEarly: false,
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

  it('offers a chosen category to untouched lines of the same merchant', (): void => {
    const sameMerchant: ImportRow[] = [
      { line: line({ index: 0 }), selected: true, categoryId: '' },
      { line: line({ index: 1, amount: 9 }), selected: true, categoryId: '' },
      {
        line: line({ index: 2 }),
        selected: true,
        categoryId: 'mine',
        touched: true,
      },
      {
        line: line({ index: 3, merchantKey: 'bakery' }),
        selected: true,
        categoryId: '',
      },
      {
        line: line({ index: 4, credit: true }),
        selected: false,
        categoryId: '',
      },
    ];

    const updated: ImportRow[] = chooseCategory(sameMerchant, 0, 'groceries');

    expect(updated.map((row: ImportRow): string => row.categoryId)).toEqual([
      'groceries',
      'groceries',
      'mine',
      '',
      '',
    ]);
    expect(describeSuggestion(updated[1]!)).toBe(
      'Same merchant as a line you set'
    );
    expect(describeSuggestion(updated[0]!)).toBe('');
  });

  it('explains where a suggestion comes from', (): void => {
    const suggested = (
      overrides: Partial<StatementPreviewLine>
    ): ImportRow => ({
      line: line(overrides),
      selected: true,
      categoryId: 'some',
    });

    expect(
      describeSuggestion(
        suggested({ suggestionSource: 'EXACT', suggestionCount: 3 })
      )
    ).toBe('Used before for this description (3×)');
    expect(
      describeSuggestion(
        suggested({
          suggestionSource: 'MERCHANT',
          suggestionBasis: 'CORNER MARKET LJ33',
        })
      )
    ).toBe('Same merchant as “CORNER MARKET LJ33”');
    expect(
      describeSuggestion(
        suggested({ suggestionSource: 'KEYWORD', suggestionBasis: 'netflix' })
      )
    ).toBe('Known merchant: “netflix”');
    expect(
      describeSuggestion(
        suggested({
          suggestionSource: 'SIMILAR',
          suggestionBasis: 'Widgetco Mall',
          suggestionCount: 2,
        })
      )
    ).toBe('Similar to “Widgetco Mall” (2×)');
    expect(describeSuggestion(suggested({}))).toBe('');
  });

  it('explains what a prepaid installment does', (): void => {
    const prepaid = (
      overrides: Partial<StatementPreviewLine>
    ): StatementPreviewLine =>
      line({
        date: '2026/10/02',
        paidEarly: true,
        installmentNumber: 7,
        installmentTotal: 8,
        ...overrides,
      });

    expect(
      describeStatus(prepaid({ samePurchaseAsTransactionId: 'saved' }))
    ).toBe('Paid early: moves 7/8 to 02/10/2026');
    expect(describeStatus(prepaid({ samePurchaseAsLine: 1 }))).toBe(
      'Paid early: moves 7/8 of line 2 to 02/10/2026'
    );
    expect(
      describeStatus(
        prepaid({ duplicate: true, duplicateOfTransactionId: 'saved' })
      )
    ).toBe('Already paid early on 02/10/2026');
    expect(describeStatus(prepaid({}))).toBe(
      'Paid early: creates the purchase, 7/8 on 02/10/2026'
    );
    expect(describeLineDetails(prepaid({ cardholder: 'Alex' }))).toBe(
      'Installment 7/8 · paid early · Alex'
    );
  });
});
