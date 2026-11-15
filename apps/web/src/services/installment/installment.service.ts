import { postFetcher } from '@/libs/fetchers.lib';
import type { Transaction } from '@/types';

class InstallmentService {
  /** Moves installments the card prepaid to the day they were paid (`yyyy/MM/dd`). */
  async payEarly(
    transactionId: string,
    installmentNumbers: readonly number[],
    paidOn: string
  ): Promise<Transaction> {
    return postFetcher<Transaction>(
      `/transactions/${transactionId}/installments/pay-early`,
      { body: JSON.stringify({ installmentNumbers, paidOn }) }
    );
  }

  /** Puts paid-early installments back in their original months. */
  async restore(
    transactionId: string,
    installmentNumbers: readonly number[]
  ): Promise<Transaction> {
    return postFetcher<Transaction>(
      `/transactions/${transactionId}/installments/restore`,
      { body: JSON.stringify({ installmentNumbers }) }
    );
  }
}

export const installmentService = new InstallmentService();
