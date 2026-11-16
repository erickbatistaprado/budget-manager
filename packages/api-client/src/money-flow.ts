import { z } from 'zod';
export const movementKindSchema = z.enum([
  'TRANSFER',
  'CARD_BILL_PAYMENT',
  'INVESTMENT',
  'REDEMPTION',
]);
export const movementDraftSchema = z.object({
  kind: movementKindSchema,
  date: z.string(),
  amount: z.coerce.number().positive(),
  fromAccountId: z.string().nullish(),
  toAccountId: z.string().nullish(),
  cardId: z.string().nullish(),
  billDueDate: z.string().nullish(),
  savingId: z.string().nullish(),
  opening: z.boolean().optional(),
  notes: z.string().nullish(),
  paymentMethod: z
    .enum(['PIX', 'BANK_TRANSFER', 'BOLETO', 'AUTOMATIC_DEBIT', 'OTHER'])
    .nullish(),
});
export const movementSchema = movementDraftSchema.extend({
  id: z.string().nullable(),
  automatic: z.boolean(),
  opening: z.boolean(),
});
export const balanceResultSchema = z.object({
  date: z.string(),
  computed: z.coerce.number(),
  balance: z.coerce.number(),
  difference: z.coerce.number(),
  saved: z.boolean(),
});
export const checkpointSchema = z.object({
  id: z.string(),
  date: z.string(),
  balance: z.coerce.number(),
});
export const valuationSchema = z.object({
  id: z.string(),
  date: z.string(),
  value: z.coerce.number(),
});
export const savingHistorySchema = z.object({
  movements: z.array(movementSchema),
  valuations: z.array(valuationSchema),
});
export const overviewSchema = z.object({
  month: z.string(),
  incomes: z.coerce.number(),
  expenses: z.coerce.number(),
  surplus: z.coerce.number(),
  invested: z.coerce.number(),
  kept: z.coerce.number(),
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      balance: z.coerce.number(),
      balanceToday: z.coerce.number(),
      balanceCheckpointDate: z.string().nullable(),
    })
  ),
  bills: z.array(
    z.object({
      cardId: z.string(),
      card: z.string(),
      dueDate: z.string(),
      total: z.coerce.number(),
      paymentAccount: z
        .object({ id: z.string(), name: z.string(), bank: z.string() })
        .nullable(),
      automatic: z.boolean(),
      paid: z.boolean(),
      creditLimit: z.coerce.number().positive().nullish(),
      availableLimit: z.coerce.number().nullish(),
    })
  ),
  unassigned: z.object({ count: z.number(), total: z.coerce.number() }),
});
export const evolutionSchema = z.object({
  month: z.string(),
  incomes: z.coerce.number(),
  expenses: z.coerce.number(),
  surplus: z.coerce.number(),
  invested: z.coerce.number(),
  accounts: z.coerce.number(),
  savings: z.coerce.number(),
  debt: z.coerce.number(),
  netWorth: z.coerce.number(),
});
export type MovementKind = z.infer<typeof movementKindSchema>;
export type MovementDraft = z.infer<typeof movementDraftSchema>;
export type Movement = z.infer<typeof movementSchema>;
export type BalanceResult = z.infer<typeof balanceResultSchema>;
export type BalanceCheckpoint = z.infer<typeof checkpointSchema>;
export type SavingHistory = z.infer<typeof savingHistorySchema>;
export type Valuation = z.infer<typeof valuationSchema>;
export type MonthOverview = z.infer<typeof overviewSchema>;
export type Evolution = z.infer<typeof evolutionSchema>;
