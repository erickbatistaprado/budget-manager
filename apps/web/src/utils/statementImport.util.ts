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
}

export interface ImportSummary {
  readonly total: number;
  readonly selected: number;
  readonly duplicates: number;
  readonly credits: number;
  readonly missingCategory: number;
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
    selectedAmount: selected.reduce(
      (sum: number, row: ImportRow): number =>
        sum + (row.line.credit ? -1 : 1) * row.line.amount,
      0
    ),
  };
}

/** The selected rows, ready for `POST /statement-imports`. */
export function toImportLines(
  rows: readonly ImportRow[]
): StatementImportLine[] {
  return rows
    .filter(
      (row: ImportRow): boolean => row.selected && Boolean(row.categoryId)
    )
    .map((row: ImportRow): StatementImportLine => ({
      date: row.line.date,
      description: row.line.description,
      amount: row.line.amount,
      credit: row.line.credit,
      installmentNumber: row.line.installmentNumber ?? null,
      installmentTotal: row.line.installmentTotal ?? null,
      categoryId: row.categoryId,
    }));
}

/** Sets a category on every selected row of the same kind (expense or credit). */
export function applyCategory(
  rows: readonly ImportRow[],
  categoryId: string,
  credit: boolean
): ImportRow[] {
  return rows.map((row: ImportRow): ImportRow =>
    row.selected && row.line.credit === credit ? { ...row, categoryId } : row
  );
}

/** `2026/11/14` from the API becomes `14/11/2026`. */
export function formatStatementDate(date: string): string {
  const [year, month, day] = date.split('/');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

export function describeStatus(line: StatementPreviewLine): string {
  if (line.duplicateOfTransactionId) {
    return 'Already imported';
  }
  if (line.duplicateOfLine !== null && line.duplicateOfLine !== undefined) {
    return `Same purchase as line ${line.duplicateOfLine + 1}`;
  }
  return line.credit ? 'Credit' : 'New';
}
