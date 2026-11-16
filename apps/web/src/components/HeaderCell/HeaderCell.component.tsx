'use client';

import { Button } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
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
    <Button
      className="flex items-center justify-center gap-2"
      variant="ghost"
      onClick={(): void => toggleSort(keyName)}
      tabIndex={0}
      aria-pressed={active}
      aria-label={t.common.sortBy(label)}
    >
      <span>{label}</span>
      {active ? <EyeIcon aria-label={t.common.sorted(sortOrder)} /> : null}
    </Button>
  );
}
