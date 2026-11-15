'use client';

import { FinancialMovements, HeaderCell } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import type {
  Transaction,
  TransactionSortKey,
  TransactionSortOrder,
} from '@/types';
import { type JSX, useCallback, useEffect, useRef } from 'react';

interface SingleTransactionProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  sortKey: TransactionSortKey;
  sortOrder: TransactionSortOrder;
  transactions?: Transaction[];
  selectedDate: Date;
  title: string;
  toggleSort: (key: TransactionSortKey) => void;
}

export default function Transactions({
  hasMore,
  isLoadingMore,
  loadMore,
  sortKey,
  sortOrder,
  transactions,
  selectedDate,
  title,
  toggleSort,
}: Readonly<SingleTransactionProps>): JSX.Element {
  const { t } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadMoreIfNeeded = useCallback((): void => {
    const element = scrollContainerRef.current;

    if (!element || !hasMore || isLoadingMore) {
      return;
    }
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 80) {
      void loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  useEffect((): void => {
    const element = scrollContainerRef.current;

    if (!element || !hasMore || isLoadingMore) {
      return;
    }
    if (element.scrollHeight <= element.clientHeight) {
      void loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore, transactions?.length]);

  return (
    <div className="flex min-h-0 w-full flex-col rounded border border-[var(--ctp-surface1)] bg-[var(--ctp-base)]/95 px-3 py-3 shadow-md">
      <div className="mb-2 grid grid-cols-4 place-items-start rounded bg-[var(--ctp-crust)]/60 px-2 py-2">
        <HeaderCell
          label={title}
          keyName="category"
          sortKey={sortKey}
          sortOrder={sortOrder}
          toggleSort={toggleSort}
        />
        <HeaderCell
          label={t.common.notes}
          keyName="notes"
          sortKey={sortKey}
          sortOrder={sortOrder}
          toggleSort={toggleSort}
        />
        <HeaderCell
          label={t.common.date}
          keyName="date"
          sortKey={sortKey}
          sortOrder={sortOrder}
          toggleSort={toggleSort}
        />
        <div className="flex w-full justify-end">
          <HeaderCell
            label={t.common.value}
            keyName="value"
            sortKey={sortKey}
            sortOrder={sortOrder}
            toggleSort={toggleSort}
          />
        </div>
      </div>
      <div
        className="min-h-64 space-y-2 overflow-y-auto lg:min-h-0 lg:flex-1"
        onScroll={loadMoreIfNeeded}
        ref={scrollContainerRef}
      >
        {transactions?.map((transaction: Transaction): JSX.Element => (
          <FinancialMovements
            key={transaction.id}
            transaction={transaction}
            selectedDate={selectedDate}
          />
        ))}
        {isLoadingMore && (
          <div className="py-2 text-center text-sm text-[var(--ctp-subtext0)]">
            {t.home.loadingMore}
          </div>
        )}
      </div>
    </div>
  );
}
