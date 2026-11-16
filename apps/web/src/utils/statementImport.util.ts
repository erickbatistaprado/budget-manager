import { en, type Messages } from '@/i18n/messages/en';
import type {
  StatementImportLine,
  StatementPreview,
  StatementPreviewLine,
  StatementSource,
} from '@budget-manager/api-client';

/** One preview line plus what the user chose for it. */
export interface ImportRow {
  readonly line: StatementPreviewLine;
  readonly selected: boolean;
  readonly categoryId: string;
  readonly updateMonth?: boolean;
  /** The user picked this row's category themselves. */
  readonly touched?: boolean;
  /** The category was copied from another row of the same merchant. */
  readonly fromSameMerchant?: boolean;
}

export interface ImportSummary {
  readonly total: number;
  readonly selected: number;
  readonly duplicates: number;
  readonly credits: number;
  readonly missingCategory: number;
  readonly suggested: number;
  readonly selectedAmount: number;
}

export const statementSourceLabels: Record<StatementSource, string> = {
  BRADESCO_CARD_PDF: 'Bradesco card statement (PDF)',
  NUBANK_CARD_PDF: 'NuBank card bill (PDF)',
  NUBANK_CARD_CSV: 'NuBank card bill (CSV)',
};

export function toRows(preview: StatementPreview): ImportRow[] {
  return preview.lines.map((line: StatementPreviewLine): ImportRow => ({
    line,
    selected: line.selected,
    categoryId: line.suggestedCategoryId ?? '',
  }));
}

export function summarize(rows: readonly ImportRow[]): ImportSummary {
  const selected: ImportRow[] = rows.filter(
    (row: ImportRow): boolean => row.selected
  );
  return {
    total: rows.length,
    selected: selected.length,
    duplicates: rows.filter((row: ImportRow): boolean => row.line.duplicate)
      .length,
    credits: rows.filter((row: ImportRow): boolean => row.line.credit).length,
    missingCategory: selected.filter(
      (row: ImportRow): boolean => !row.categoryId
    ).length,
    suggested: rows.filter(
      (row: ImportRow): boolean =>
        !row.line.duplicate && Boolean(row.line.suggestedCategoryId)
    ).length,
    selectedAmount: selected.reduce(
      (sum: number, row: ImportRow): number =>
        sum + (row.line.credit ? -1 : 1) * row.line.amount,
      0
    ),
  };
}

/** The selected rows, ready for `POST /statement-imports`. */
export function toImportLines(
  rows: readonly ImportRow[],
  includeDuplicates = false
): StatementImportLine[] {
  return rows
    .filter(
      (row: ImportRow): boolean =>
        (row.selected || (includeDuplicates && row.line.duplicate)) &&
        Boolean(row.categoryId)
    )
    .map((row: ImportRow): StatementImportLine => ({
      date: row.line.date,
      description: row.line.description,
      amount: row.line.amount,
      credit: row.line.credit,
      installmentNumber: row.line.installmentNumber ?? null,
      installmentTotal: row.line.installmentTotal ?? null,
      paidEarly: row.line.paidEarly,
      categoryId: row.categoryId,
      ...(row.updateMonth ? { updateMonth: true } : {}),
    }));
}

/**
 * Sets the category of one row and offers it to the other rows of the same merchant, unless the
 * user already chose theirs or they are already saved.
 */
export function chooseCategory(
  rows: readonly ImportRow[],
  index: number,
  categoryId: string
): ImportRow[] {
  const chosen: ImportRow | undefined = rows.find(
    (row: ImportRow): boolean => row.line.index === index
  );
  if (!chosen) {
    return [...rows];
  }
  const merchant: string = chosen.line.merchantKey;
  return rows.map((row: ImportRow): ImportRow => {
    if (row.line.index === index) {
      return { ...row, categoryId, touched: true, fromSameMerchant: false };
    }
    const sameMerchant: boolean =
      merchant !== '' &&
      row.line.merchantKey === merchant &&
      row.line.credit === chosen.line.credit;
    return sameMerchant && !row.touched && !row.line.duplicate
      ? { ...row, categoryId, fromSameMerchant: true }
      : row;
  });
}

/** Why a row has the category it shows, for the hint under the dropdown. */
export function describeSuggestion(
  row: ImportRow,
  messages: Messages['import'] = en.import
): string {
  if (row.touched) {
    return '';
  }
  if (row.fromSameMerchant) {
    return messages.suggestions.sameMerchantYouSet;
  }
  const { suggestionSource, suggestionBasis, suggestionCount } = row.line;
  if (row.line.subscriptionName) return row.line.subscriptionName;
  switch (suggestionSource) {
    case 'EXACT':
      return messages.suggestions.exact(suggestionCount);
    case 'MERCHANT':
      return messages.suggestions.merchant(
        suggestionBasis ?? '',
        suggestionCount
      );
    case 'KEYWORD':
      return messages.suggestions.keyword(suggestionBasis ?? '');
    case 'SIMILAR':
      return messages.suggestions.similar(
        suggestionBasis ?? '',
        suggestionCount
      );
    case 'PURCHASE':
      return messages.suggestions.purchase(suggestionBasis ?? '');
    default:
      return '';
  }
}

/** Sets a category on every selected row of the same kind (expense or credit). */
export function applyCategory(
  rows: readonly ImportRow[],
  categoryId: string,
  credit: boolean
): ImportRow[] {
  return rows.map((row: ImportRow): ImportRow =>
    row.selected && row.line.credit === credit
      ? { ...row, categoryId, touched: true, fromSameMerchant: false }
      : row
  );
}

/** `2026/11/14` from the API becomes `14/11/2026`. */
export function formatStatementDate(date: string): string {
  const [year, month, day] = date.split('/');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

export function describeStatus(
  line: StatementPreviewLine,
  messages: Messages['import'] = en.import
): string {
  if (line.paidEarly) {
    return describePrepaid(line, messages);
  }
  if (line.duplicateOfTransactionId) {
    return messages.statuses.alreadyImported;
  }
  if (line.duplicateOfLine !== null && line.duplicateOfLine !== undefined) {
    return messages.statuses.samePurchaseAsLine(line.duplicateOfLine + 1);
  }
  return line.credit ? messages.statuses.credit : messages.statuses.new;
}

/** A prepaid installment moves an installment; it never adds an expense. */
function describePrepaid(
  line: StatementPreviewLine,
  messages: Messages['import'] = en.import
): string {
  const installment = `${line.installmentNumber ?? '?'}/${line.installmentTotal ?? '?'}`;
  const day: string = formatStatementDate(line.date);
  if (line.duplicateOfTransactionId) {
    return messages.statuses.prepaidAlreadyPaid(day);
  }
  if (line.samePurchaseAsTransactionId) {
    return messages.statuses.prepaidMoves(installment, day);
  }
  if (
    line.samePurchaseAsLine !== null &&
    line.samePurchaseAsLine !== undefined
  ) {
    return messages.statuses.prepaidMovesLine(
      installment,
      line.samePurchaseAsLine + 1,
      day
    );
  }
  return messages.statuses.prepaidCreates(installment, day);
}

/** The second line under a description: installments, prepayment and cardholder. */
export function describeLineDetails(
  line: StatementPreviewLine,
  messages: Messages['import'] = en.import
): string {
  const parts: string[] = [];
  if (line.installmentNumber && line.installmentTotal) {
    parts.push(
      line.paidEarly
        ? messages.lineDetails.installmentPaidEarly(
            line.installmentNumber,
            line.installmentTotal
          )
        : messages.lineDetails.installmentCreatesAll(
            line.installmentNumber,
            line.installmentTotal
          )
    );
  }
  if (line.cardholder) {
    parts.push(line.cardholder);
  }
  return parts.join(' · ');
}
