import { getFetcher } from '@/libs/fetchers.lib';
import type { Card } from '@budget-manager/api-client';
import useSWR, { type SWRResponse } from 'swr';

export default function useCards(): SWRResponse<Card[], Error> {
  return useSWR('/cards', getFetcher<Card[]>);
}
