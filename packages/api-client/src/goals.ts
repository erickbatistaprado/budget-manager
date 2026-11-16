import { z } from 'zod';
import type { OpenApi } from './index';
export const goalSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.coerce.number(),
  kind: z.enum(['NEED', 'WANT']),
  link: z.string().nullish(),
  notes: z.string().nullish(),
  targetDate: z.string().nullish(),
  position: z.number().int(),
  monthlyAmount: z.coerce.number().nullish(),
  savingId: z.string().nullish(),
  status: z.enum(['ACTIVE', 'ACHIEVED', 'CANCELLED']),
  achievedAt: z.string().nullish(),
  expenseTransactionId: z.string().nullish(),
  savedAtPurchase: z.coerce.number().nullish(),
  actualPrice: z.coerce.number().nullish(),
});
export const goalAllocationSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  date: z.string(),
  amount: z.coerce.number(),
  movementId: z.string().nullable(),
});
export const goalForecastSchema = z.object({
  id: z.string(),
  saved: z.coerce.number(),
  remaining: z.coerce.number(),
  expectedMonth: z.string().nullable(),
  late: z.boolean(),
  extraMonthlyAmount: z.coerce.number().nullable(),
  firstPositionMonth: z.string().nullable(),
});
export const goalPlanSchema = z.object({
  pace: z.coerce.number(),
  averagePace: z.coerce.number(),
  paceOverride: z.coerce.number().nullable(),
  reserved: z.coerce.number(),
  goals: z.array(goalForecastSchema),
});
export type Goal = z.infer<typeof goalSchema>;
export type GoalAllocation = z.infer<typeof goalAllocationSchema>;
export type GoalForecast = z.infer<typeof goalForecastSchema>;
export type GoalPlan = z.infer<typeof goalPlanSchema>;
export type GoalDraft = OpenApi.GoalDraft;
export type GoalAllocationDraft = OpenApi.GoalAllocationDraft;

export type GoalSplitDraft = OpenApi.GoalSplitDraft;
export const goalSplitSchema = z.object({
  goals: z.record(z.string(), z.coerce.number()),
  investmentAmount: z.coerce.number(),
  saved: z.boolean(),
});
export type GoalSplit = z.infer<typeof goalSplitSchema>;
export type GoalPurchaseDraft = OpenApi.GoalPurchaseDraft;
export const goalSavingsTipSchema = z.object({
  categoryId: z.string(),
  category: z.string(),
  amount: z.coerce.number(),
  average: z.coerce.number(),
  difference: z.coerce.number(),
  percentAbove: z.coerce.number().nullable(),
  goalId: z.string().nullable(),
  goalName: z.string().nullable(),
  expectedMonth: z.string().nullable(),
  improvedMonth: z.string().nullable(),
  monthsGained: z.number().int().nullable(),
});
export type GoalSavingsTip = z.infer<typeof goalSavingsTipSchema>;
