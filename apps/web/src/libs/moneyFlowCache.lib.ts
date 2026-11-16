import { mutate } from 'swr';
import { refreshTransactions } from './transactionsCache.lib';
export async function refreshMoneyFlow(): Promise<void> {
  await refreshTransactions();
  await mutate(
    (key: unknown): boolean =>
      typeof key === 'string' &&
      ['/accounts', '/cards', '/savings', '/movements', '/overview'].some(
        (prefix): boolean => key.startsWith(prefix)
      )
  );
}
