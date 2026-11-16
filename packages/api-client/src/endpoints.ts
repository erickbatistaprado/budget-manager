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
  saveAccount(account: Omit<Account, 'id'>, id?: string): Promise<Account> {
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
  saveCard(card: Omit<Card, 'id'>, id?: string): Promise<Card> {
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

  createSaving(saving: Omit<Saving, 'id'>) {
    return this.client.request('/savings', savingSchema, {
      method: 'POST',
      body: saving,
    });
  }

  deleteSaving(id: string) {
    return this.client.command(`/savings/${id}`, { method: 'DELETE' });
  }
}
