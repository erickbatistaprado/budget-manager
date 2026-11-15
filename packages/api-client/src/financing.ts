import { z } from 'zod';
import { PaymentMethod } from './models';

export const financingDraftSchema = z.object({
  name: z.string(),
  kind: z.enum(['VEHICLE', 'REAL_ESTATE', 'OTHER']),
  lender: z.string().nullish(),
  purchasePrice: z.number().nullish(),
  downPayment: z.number().nullish(),
  iof: z.number().nullish(),
  registration: z.number().nullish(),
  valuationFee: z.number().nullish(),
  categoryId: z.string(),
  paymentMethod: z.enum(PaymentMethod),
  accountId: z.string().nullish(),
  alreadyPaid: z.number().nullish(),
  system: z.enum(['SAC', 'PRICE']),
  amount: z.number(),
  annualRate: z.number().nullish(),
  monthlyRate: z.number().optional(),
  term: z.number(),
  firstDueDate: z.string(),
  statedInstallment: z.number().nullish(),
  insurance: z.number().nullish(),
  fees: z.number().nullish(),
});
export const financingRowSchema = z.object({
  status: z.enum(['SCHEDULED', 'PAID']),
  number: z.number(),
  dueDate: z.string(),
  principal: z.number(),
  interest: z.number(),
  insurance: z.number(),
  fees: z.number(),
  payment: z.number(),
  balance: z.number(),
  paidAmount: z.number().nullish(),
});
export const financingPreviewSchema = z.object({
  effectiveMonthlyRate: z.number(),
  totalInterest: z.number(),
  totalPaid: z.number(),
  schedule: z.array(financingRowSchema),
});
export const financingSchema = z.object({
  extraPaid: z.number(),
  payoffDate: z.string(),
  id: z.string(),
  contract: financingDraftSchema,
  calculation: financingPreviewSchema,
});
export const financingSimulationSchema = z.object({
  option: z.enum(['REDUCE_TERM', 'REDUCE_PAYMENT']),
  interestSaved: z.number(),
  schedule: z.array(financingRowSchema),
});
export type FinancingDraft = z.infer<typeof financingDraftSchema>;
export type FinancingRow = z.infer<typeof financingRowSchema>;
export type FinancingPreview = z.infer<typeof financingPreviewSchema>;
export type Financing = z.infer<typeof financingSchema>;
export type FinancingSimulation = z.infer<typeof financingSimulationSchema>;
export interface FinancingAdjustment {
  date: string;
  amount: number;
  option?: 'REDUCE_TERM' | 'REDUCE_PAYMENT';
}
