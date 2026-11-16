import { ProgressBar } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import { formatBRL } from '@/utils/analytics.util';
import type { JSX } from 'react';

export default function CardLimit({
  creditLimit,
  availableLimit,
  showBar = false,
}: {
  creditLimit?: number | null;
  availableLimit?: number | null;
  showBar?: boolean;
}): JSX.Element | null {
  const { t, language } = useI18n();
  if (
    creditLimit === null ||
    creditLimit === undefined ||
    availableLimit === null ||
    availableLimit === undefined
  )
    return null;
  const usedPercent = ((creditLimit - availableLimit) / creditLimit) * 100;
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 text-sm">
      <p>
        {t.cards.availableLimit} {formatBRL(availableLimit, language)}{' '}
        {t.cards.of} {formatBRL(creditLimit, language)}
      </p>
      {availableLimit < 0 && (
        <p className="text-[var(--ctp-red)]">{t.cards.overLimit}</p>
      )}
      {showBar && (
        <ProgressBar
          value={usedPercent}
          label={t.cards.creditLimit}
          danger={usedPercent > 90}
        />
      )}
    </div>
  );
}
