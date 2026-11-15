'use client';

import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/utils/globalFormats.util';
import type { JSX } from 'react';

export interface MoneyProps {
  className?: string;
  value?: number;
}

export default function Money({
  className,
  value,
}: Readonly<MoneyProps>): JSX.Element {
  const { language } = useI18n();

  return <div className={className}>{formatCurrency(value, language)}</div>;
}
