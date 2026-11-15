import { getFetcher } from '@/libs/fetchers.lib';
import type { Account } from '@budget-manager/api-client';
import useSWR, { type SWRResponse } from 'swr';
export default function useAccounts(): SWRResponse<Account[], Error> {
  return useSWR('/accounts', getFetcher<Account[]>);
}
