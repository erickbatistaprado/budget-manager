import { z } from 'zod';

export enum RepeatInterval {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  NONE = 'NONE',
}

export enum SavingLocation {
  CASH = 'CASH',
  CHECKING_ACCOUNT = 'CHECKING_ACCOUNT',
  SAVINGS_ACCOUNT = 'SAVINGS_ACCOUNT',
  INVESTMENT = 'INVESTMENT',
  OTHER = 'OTHER',
}

export enum InvestmentType {
  TESOURO_DIRETO = 'TESOURO_DIRETO',
  CDB = 'CDB',
  LCI_LCA = 'LCI_LCA',
  CREDIT_BONDS = 'CREDIT_BONDS',
  STOCKS = 'STOCKS',
  REAL_ESTATE_FUNDS = 'REAL_ESTATE_FUNDS',
  ETFS = 'ETFS',
  BDRS = 'BDRS',
  CRYPTO = 'CRYPTO',
  INVESTMENT_FUNDS = 'INVESTMENT_FUNDS',
  PRIVATE_PENSION = 'PRIVATE_PENSION',
  FOREIGN = 'FOREIGN',
  OTHER_INVESTMENT = 'OTHER_INVESTMENT',
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  transactionType: z.enum(TransactionType),
});

export const installmentSchema = z.object({
  id: z.string(),
  installmentNumber: z.number(),
  totalInstallments: z.number(),
  amount: z.coerce.number(),
  dueDate: z.string(),
  paidEarly: z.boolean().default(false),
});

export const transactionMonthSchema = z.object({
  month: z.string(),
  amount: z.coerce.number().nullish(),
  date: z.string().nullish(),
  notes: z.string().nullish(),
  skipped: z.boolean(),
});

export const transactionSchema = z.object({
  id: z.string(),
  category: categorySchema,
  notes: z.string().nullish(),
  totalValue: z.coerce.number(),
  installmentNumbers: z.number().nullish(),
  installments: z.array(installmentSchema).nullish(),
  repeatUntil: z.string().nullish(),
  months: z.array(transactionMonthSchema).nullish(),
  repeats: z.enum(RepeatInterval),
  date: z.string(),
});

export const savingSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.coerce.number(),
  location: z.enum(SavingLocation),
  investmentType: z.enum(InvestmentType).nullish(),
  updatedAt: z.string().nullish(),
});

export const roleSchema = z.object({
  id: z.string(),
  roleName: z.enum(UserRole),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(roleSchema),
});

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    content: z.array(item),
    first: z.boolean(),
    last: z.boolean(),
    number: z.number(),
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
  });

export const statementSourceSchema = z.enum([
  'BRADESCO_CARD_PDF',
  'NUBANK_CARD_PDF',
  'NUBANK_CARD_CSV',
]);

export const statementPreviewLineSchema = z.object({
  index: z.number(),
  date: z.string(),
  description: z.string(),
  amount: z.coerce.number(),
  credit: z.boolean(),
  installmentNumber: z.number().nullish(),
  installmentTotal: z.number().nullish(),
  paidEarly: z.boolean().default(false),
  cardholder: z.string().nullish(),
  suggestedCategoryId: z.string().nullish(),
  suggestionSource: z
    .enum(['DUPLICATE', 'PURCHASE', 'EXACT', 'MERCHANT', 'KEYWORD', 'SIMILAR'])
    .nullish(),
  suggestionBasis: z.string().nullish(),
  suggestionCount: z.number().default(0),
  merchantKey: z.string().default(''),
  duplicate: z.boolean(),
  duplicateOfTransactionId: z.string().nullish(),
  duplicateOfLine: z.number().nullish(),
  samePurchaseAsLine: z.number().nullish(),
  samePurchaseAsTransactionId: z.string().nullish(),
  selected: z.boolean(),
});

export const statementPreviewSchema = z.object({
  source: statementSourceSchema,
  printedTotal: z.coerce.number().nullish(),
  parsedTotal: z.coerce.number().nullish(),
  totalsMatch: z.boolean(),
  lines: z.array(statementPreviewLineSchema),
});

export const statementImportResultSchema = z.object({
  imported: z.number(),
  skippedAsDuplicates: z.number(),
  movedInstallments: z.number().default(0),
});

export type Category = z.infer<typeof categorySchema>;
export type Installment = z.infer<typeof installmentSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Saving = z.infer<typeof savingSchema>;
export type StatementSource = z.infer<typeof statementSourceSchema>;
export type StatementPreviewLine = z.infer<typeof statementPreviewLineSchema>;
export type StatementPreview = z.infer<typeof statementPreviewSchema>;
export type StatementImportResult = z.infer<typeof statementImportResultSchema>;
export interface StatementImportLine {
  readonly date: string;
  readonly description: string;
  readonly amount: number;
  readonly credit: boolean;
  readonly installmentNumber?: number | null;
  readonly installmentTotal?: number | null;
  readonly paidEarly: boolean;
  readonly categoryId: string;
}
export type Role = z.infer<typeof roleSchema>;
export type User = z.infer<typeof userSchema>;
export type Page<T> = {
  content: T[];
  first: boolean;
  last: boolean;
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type TransactionSortKey = 'category' | 'notes' | 'date' | 'value';
export type TransactionSortOrder = 'asc' | 'desc';
