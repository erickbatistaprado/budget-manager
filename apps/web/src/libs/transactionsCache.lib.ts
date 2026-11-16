import { mutate } from 'swr';
type Refresh = () => Promise<unknown>;

const lists = new Set<Refresh>();

/**
 * Lists of transactions use `useSWRInfinite`, whose cache entries SWR's global `mutate(filter)`
 * skips on purpose, so a change made elsewhere never reached them. Each list registers its own
 * refresh while it is on screen, and every write calls {@link refreshTransactions}.
 */
export function registerTransactionsList(refresh: Refresh): () => void {
  lists.add(refresh);
  return (): void => {
    lists.delete(refresh);
  };
}

/** Reloads every list of transactions on screen. */
export async function refreshTransactions(): Promise<void> {
  await mutate(
    (key: unknown): boolean =>
      typeof key === 'string' &&
      ['/accounts', '/overview'].some((prefix): boolean =>
        key.startsWith(prefix)
      )
  );
  await Promise.all(
    [...lists].map((refresh: Refresh): Promise<unknown> => refresh())
  );
}
