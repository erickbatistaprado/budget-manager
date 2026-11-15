'use client';

import { useI18n } from '@/i18n/useI18n';
import clsx from 'clsx';
import type { JSX } from 'react';
import type { IconType } from 'react-icons';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

type SortKey = 'category' | 'notes' | 'date' | 'value';
type SortOrder = 'asc' | 'desc';

interface HeaderCellProps {
  label: string;
  keyName: SortKey;
  sortKey: SortKey;
  sortOrder: SortOrder;
  toggleSort: (key: SortKey) => void;
}

export default function HeaderCell({
  label,
  keyName,
  sortKey,
  sortOrder,
  toggleSort,
}: Readonly<HeaderCellProps>): JSX.Element {
  const { t } = useI18n();
  const active: boolean = sortKey === keyName;
  const EyeIcon: IconType = sortOrder === 'asc' ? FaChevronUp : FaChevronDown;

  return (
    <button
      className={clsx(
        'flex cursor-pointer items-center justify-center gap-2 font-bold transition-colors select-none hover:text-[var(--ctp-subtext0)]',
        active ? 'text-[var(--ctp-text)]' : 'text-[var(--ctp-subtext1)]'
      )}
      onClick={(): void => toggleSort(keyName)}
      tabIndex={0}
      aria-pressed={active}
      aria-label={t.common.sortBy(label)}
    >
      <span>{label}</span>
      {active ? <EyeIcon aria-label={t.common.sorted(sortOrder)} /> : null}
    </button>
  );
}
