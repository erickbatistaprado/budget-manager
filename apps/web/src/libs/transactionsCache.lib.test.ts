import {
  refreshTransactions,
  registerTransactionsList,
} from '@/libs/transactionsCache.lib';

describe('transactionsCache', () => {
  it('refreshes every registered list until it unregisters', async () => {
    const incomes = jest.fn().mockResolvedValue(undefined);
    const expenses = jest.fn().mockResolvedValue(undefined);
    const unregisterIncomes = registerTransactionsList(incomes);
    const unregisterExpenses = registerTransactionsList(expenses);

    await refreshTransactions();
    unregisterIncomes();
    await refreshTransactions();
    unregisterExpenses();

    expect(incomes).toHaveBeenCalledTimes(1);
    expect(expenses).toHaveBeenCalledTimes(2);
  });
});
