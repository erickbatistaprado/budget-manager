import { useState, type JSX } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { useI18n } from '@/i18n/useI18n';
import type { Saving } from '@/types';
import { formatBRL, formatPercent } from '@/utils/analytics.util';
import {
  isSavingStale,
  savingUpdatedDate,
  savingsShare,
} from '@/utils/savings.util';

export default function SavingEntry({
  saving,
  total,
  today,
  onEdit,
  onDelete,
}: {
  saving: Saving;
  total: number;
  today: Date;
  onEdit: (saving: Saving) => void;
  onDelete: (id: string) => Promise<void>;
}): JSX.Element {
  const { language, t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const date = savingUpdatedDate(saving);
  async function remove(): Promise<void> {
    setDeleting(true);
    try {
      await onDelete(saving.id);
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <li className="min-w-0 rounded-xl border border-[var(--ctp-surface1)] px-3 py-2 sm:flex sm:min-h-[72px] sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold break-words">{saving.name}</h3>
          <p className="text-xs text-[var(--ctp-subtext1)]">
            {t.savings.locations[saving.location]}
            {saving.investmentType &&
              ` · ${t.savings.investmentTypes[saving.investmentType]}`}
            <span className="ml-2 text-xs text-[var(--ctp-subtext0)]">
              {date
                ? t.savings.updated(
                    formatDistanceToNow(date, {
                      addSuffix: true,
                      locale: language === 'pt' ? ptBR : enUS,
                    })
                  )
                : t.savings.unknownUpdated}
            </span>
            {isSavingStale(saving, today) && (
              <span className="ml-2 text-xs text-[var(--ctp-peach)]">
                {t.savings.review}
              </span>
            )}
          </p>
        </div>
        <div className="text-right break-all">
          <strong>{formatBRL(saving.amount, language)}</strong>
          <p className="text-xs text-[var(--ctp-subtext1)]">
            {formatPercent(savingsShare(saving.amount, total), language)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2 text-xs sm:mt-0 sm:max-w-48">
        {confirming ? (
          <>
            <span>{t.savings.confirmDelete}</span>
            <button
              type="button"
              disabled={deleting}
              onClick={(): void => {
                void remove();
              }}
              className="rounded-lg bg-[var(--ctp-red)]/15 p-2 text-[var(--ctp-red)]"
            >
              {t.savings.confirm}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={(): void => setConfirming(false)}
            >
              {t.savings.cancel}
            </button>
          </>
        ) : (
          <>
            <button
              className="rounded-lg px-2 py-2"
              type="button"
              onClick={(): void => onEdit(saving)}
            >
              {t.common.edit}
            </button>
            <button
              type="button"
              onClick={(): void => setConfirming(true)}
              className="rounded-lg px-2 py-2 text-[var(--ctp-red)]"
            >
              {t.common.delete}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
