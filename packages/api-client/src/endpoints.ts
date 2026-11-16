import { goalSchema, goalAllocationSchema, goalPlanSchema } from './goals';
import type {
  Goal,
  GoalDraft,
  GoalAllocation,
  GoalAllocationDraft,
  GoalPlan,
} from './goals';
import {
  movementSchema,
  balanceResultSchema,
  checkpointSchema,
  savingHistorySchema,
  valuationSchema,
  overviewSchema,
  evolutionSchema,
} from './money-flow';
import type {
  Movement,
  MovementDraft,
  BalanceResult,
  BalanceCheckpoint,
  SavingHistory,
  Valuation,
  MonthOverview,
  Evolution,
} from './money-flow';
import type {
  Financing,
  FinancingPreview,
  FinancingSimulation,
  FinancingDraft,
  FinancingAdjustment,
} from './financing';
import {
  financingSchema,
  financingPreviewSchema,
  financingSimulationSchema,
} from './financing';
import {
  accountSchema,
  type Account,
  categorySchema,
  cardSchema,
  type Card,
  pageSchema,
  savingSchema,
  transactionSchema,
  userSchema,
  type Saving,
  type Transaction,
  type TransactionSortKey,
  type TransactionSortOrder,
} from './models';
import { BudgetManagerClient } from './client';
import { z } from 'zod';

export class BudgetManagerApi {
  private readonly client: BudgetManagerClient;

  constructor(client: BudgetManagerClient) {
    this.client = client;
  }

  goals(): Promise<Goal[]> {
    return this.client.request('/goals', z.array(goalSchema));
  }
  createGoal(draft: GoalDraft): Promise<Goal> {
    return this.client.request('/goals', goalSchema, {
      method: 'POST',
      body: draft,
    });
  }
  updateGoal(id: string, draft: GoalDraft): Promise<Goal> {
    return this.client.request(`/goals/${id}`, goalSchema, {
      method: 'PUT',
      body: draft,
    });
  }
  deleteGoal(id: string): Promise<void> {
    return this.client.command(`/goals/${id}`, { method: 'DELETE' });
  }
  moveGoal(id: string, position: number): Promise<void> {
    return this.client.command(`/goals/${id}/position`, {
      method: 'PUT',
      body: { position },
    });
  }
  goalAllocations(id: string): Promise<GoalAllocation[]> {
    return this.client.request(
      `/goals/${id}/allocations`,
      z.array(goalAllocationSchema)
    );
  }
  allocateGoal(
    id: string,
    draft: GoalAllocationDraft
  ): Promise<GoalAllocation> {
    return this.client.request(
      `/goals/${id}/allocations`,
      goalAllocationSchema,
      { method: 'POST', body: draft }
    );
  }
  goalPlan(): Promise<GoalPlan> {
    return this.client.request('/goals/plan', goalPlanSchema);
  }
  setGoalPace(monthlyAmount: number | null): Promise<void> {
    return this.client.command('/goals/pace', {
      method: 'PUT',
      body: { monthlyAmount },
    });
  }

  financings(): Promise<Financing[]> {
    return this.client.request('/financings', z.array(financingSchema));
  }
  financing(id: string): Promise<Financing> {
    return this.client.request(`/financings/${id}`, financingSchema);
  }
  previewFinancing(draft: FinancingDraft): Promise<FinancingPreview> {
    return this.client.request('/financings/preview', financingPreviewSchema, {
      method: 'POST',
      body: draft,
    });
  }
  createFinancing(draft: FinancingDraft): Promise<Financing> {
    return this.client.request('/financings', financingSchema, {
      method: 'POST',
      body: draft,
    });
  }
  updateFinancing(id: string, draft: FinancingDraft): Promise<Financing> {
    return this.client.request(`/financings/${id}`, financingSchema, {
      method: 'PUT',
      body: draft,
    });
  }
  deleteFinancing(id: string): Promise<void> {
    return this.client.command(`/financings/${id}`, { method: 'DELETE' });
  }
  simulateFinancingExtra(
    id: string,
    change: FinancingAdjustment
  ): Promise<FinancingSimulation[]> {
    return this.client.request(
      `/financings/${id}/extra-payments/simulate`,
      z.array(financingSimulationSchema),
      { method: 'POST', body: change }
    );
  }
  payFinancingExtra(
    id: string,
    change: FinancingAdjustment
  ): Promise<Financing> {
    return this.client.request(
      `/financings/${id}/extra-payments`,
      financingSchema,
      { method: 'POST', body: change }
    );
  }
  syncFinancingBalance(
    id: string,
    change: FinancingAdjustment
  ): Promise<Financing> {
    return this.client.request(
      `/financings/${id}/balance-syncs`,
      financingSchema,
      { method: 'POST', body: change }
    );
  }
  payFinancingInstallment(
    id: string,
    number: number,
    amount: number
  ): Promise<Financing> {
    return this.client.request(
      `/financings/${id}/installments/${number}/paid`,
      financingSchema,
      { method: 'POST', body: { amount } }
    );
  }
  changeFinancingDueDay(
    id: string,
    fromInstallment: number,
    dueDay: number
  ): Promise<Financing> {
    return this.client.request(
      `/financings/${id}/due-day-changes`,
      financingSchema,
      { method: 'POST', body: { fromInstallment, dueDay } }
    );
  }

  movements(startDate: string, endDate: string): Promise<Movement[]> {
    return this.client.request(
      `/movements?${new URLSearchParams({ startDate, endDate })}`,
      z.array(movementSchema)
    );
  }
  saveMovement(draft: MovementDraft, id?: string): Promise<Movement> {
    return this.client.request(
      id ? `/movements/${id}` : '/movements',
      movementSchema,
      { method: id ? 'PUT' : 'POST', body: draft }
    );
  }
  deleteMovement(id: string): Promise<void> {
    return this.client.command(`/movements/${id}`, { method: 'DELETE' });
  }
  accountBalance(id: string, date: string): Promise<BalanceResult> {
    return this.client.request(
      `/accounts/${id}/balance?${new URLSearchParams({ date })}`,
      balanceResultSchema
    );
  }
  saveBalanceCheckpoint(
    id: string,
    date: string,
    balance: number,
    preview: boolean
  ): Promise<BalanceResult> {
    return this.client.request(
      `/accounts/${id}/balance-checkpoints`,
      balanceResultSchema,
      { method: 'POST', body: { date, balance, preview } }
    );
  }
  balanceCheckpoints(id: string): Promise<BalanceCheckpoint[]> {
    return this.client.request(
      `/accounts/${id}/balance-checkpoints`,
      z.array(checkpointSchema)
    );
  }
  deleteBalanceCheckpoint(id: string, checkpointId: string): Promise<void> {
    return this.client.command(
      `/accounts/${id}/balance-checkpoints/${checkpointId}`,
      { method: 'DELETE' }
    );
  }
  savingHistory(id: string): Promise<SavingHistory> {
    return this.client.request(`/savings/${id}/history`, savingHistorySchema);
  }
  valueSaving(id: string, date: string, value: number): Promise<Valuation> {
    return this.client.request(`/savings/${id}/valuations`, valuationSchema, {
      method: 'POST',
      body: { date, value },
    });
  }
  overview(month: string): Promise<MonthOverview> {
    return this.client.request(`/overview/${month}`, overviewSchema);
  }
  evolution(): Promise<Evolution[]> {
    return this.client.request('/overview/evolution', z.array(evolutionSchema));
  }

  login(email: string, password: string) {
    return this.client.request(
      '/auth/login',
      z.object({ message: z.string() }),
      { method: 'POST', body: { email, password } }
    );
  }

  logout() {
    return this.client.command('/auth/logout', { method: 'POST' });
  }

  register(email: string, password: string, name?: string) {
    return this.client.request('/users', userSchema, {
      method: 'POST',
      body: { email, password, name },
    });
  }

  currentUser() {
    return this.client.request('/users/current', userSchema);
  }

  updateUser(user: {
    readonly name?: string;
    readonly password?: string;
    readonly currentPassword?: string;
  }): Promise<void> {
    return this.client.command('/users', { method: 'PUT', body: user });
  }

  categories(transactionType: 'INCOME' | 'EXPENSE') {
    return this.client.request(
      `/categories/type/${transactionType}`,
      z.array(categorySchema)
    );
  }

  transactions(query: {
    readonly transactionType: 'INCOME' | 'EXPENSE';
    readonly startDate: string;
    readonly endDate: string;
    readonly sortKey?: TransactionSortKey;
    readonly sortOrder?: TransactionSortOrder;
    readonly page?: number;
  }) {
    const params = new URLSearchParams({
      transactionType: query.transactionType,
      startDate: query.startDate,
      endDate: query.endDate,
      sortKey: query.sortKey ?? 'date',
      sortOrder: query.sortOrder ?? 'desc',
      page: String(query.page ?? 0),
    });
    return this.client.request(
      `/transactions?${params.toString()}`,
      pageSchema(transactionSchema)
    );
  }

  createTransaction(transaction: Omit<Transaction, 'id' | 'installments'>) {
    return this.client.request('/transactions', transactionSchema, {
      method: 'POST',
      body: transaction,
    });
  }

  deleteTransaction(id: string) {
    return this.client.command(`/transactions/${id}`, { method: 'DELETE' });
  }

  changeTransactionMonth(
    id: string,
    month: string,
    change: { amount: number; date: string; notes?: string | null }
  ): Promise<Transaction> {
    return this.client.request(
      `/transactions/${id}/months/${month}`,
      transactionSchema,
      { method: 'PUT', body: change }
    );
  }

  skipTransactionMonth(id: string, month: string): Promise<void> {
    return this.client.command(`/transactions/${id}/months/${month}`, {
      method: 'DELETE',
    });
  }

  restoreTransactionMonth(id: string, month: string): Promise<void> {
    return this.client.command(`/transactions/${id}/months/${month}/override`, {
      method: 'DELETE',
    });
  }

  splitTransaction(
    id: string,
    month: string,
    change: Omit<Transaction, 'id' | 'installments' | 'months' | 'repeatUntil'>
  ): Promise<Transaction> {
    return this.client.request(
      `/transactions/${id}/split/${month}`,
      transactionSchema,
      { method: 'POST', body: change }
    );
  }

  deleteTransactionFrom(id: string, month: string): Promise<void> {
    return this.client.command(`/transactions/${id}/from/${month}`, {
      method: 'DELETE',
    });
  }

  accounts(): Promise<Account[]> {
    return this.client.request('/accounts', z.array(accountSchema));
  }
  saveAccount(
    account: Omit<Account, 'id' | 'balance' | 'balanceCheckpointDate'>,
    id?: string
  ): Promise<Account> {
    return this.client.request(
      id ? `/accounts/${id}` : '/accounts',
      accountSchema,
      {
        method: id ? 'PUT' : 'POST',
        body: account,
      }
    );
  }
  deleteAccount(id: string): Promise<void> {
    return this.client.command(`/accounts/${id}`, { method: 'DELETE' });
  }

  cards(): Promise<Card[]> {
    return this.client.request('/cards', z.array(cardSchema));
  }
  saveCard(
    card: Omit<Card, 'id' | 'paymentAccount' | 'fundingAccount'> & {
      paymentAccountId?: string | null;
      fundingAccountId?: string | null;
    },
    id?: string
  ): Promise<Card> {
    return this.client.request(id ? `/cards/${id}` : '/cards', cardSchema, {
      method: id ? 'PUT' : 'POST',
      body: card,
    });
  }
  deleteCard(id: string): Promise<void> {
    return this.client.command(`/cards/${id}`, { method: 'DELETE' });
  }

  savings() {
    return this.client.request('/savings', z.array(savingSchema));
  }

  createSaving(saving: Omit<Saving, 'id' | 'invested' | 'gain' | 'updatedAt'>) {
    return this.client.request('/savings', savingSchema, {
      method: 'POST',
      body: saving,
    });
  }

  deleteSaving(id: string) {
    return this.client.command(`/savings/${id}`, { method: 'DELETE' });
  }
}
