import { Button, Panel } from '@/components/ui';
import SavingActions from '@/components/MoneyFlow/SavingActions';
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
    <Panel
      as="li"
      className="min-w-0 sm:flex sm:min-h-[72px] sm:flex-wrap sm:items-center sm:gap-3"
    >
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
          <strong>
            {t.moneyFlow.current}: {formatBRL(saving.amount, language)}
          </strong>
          <p>
            {t.moneyFlow.invested}:{' '}
            {formatBRL(saving.invested ?? saving.amount, language)}
          </p>
          <p>
            {t.moneyFlow.gain}: {formatBRL(saving.gain ?? 0, language)}
          </p>
          <p className="text-xs text-[var(--ctp-subtext1)]">
            {formatPercent(savingsShare(saving.amount, total), language)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2 text-xs sm:mt-0 sm:max-w-48">
        {confirming ? (
          <>
            <span>{t.savings.confirmDelete}</span>
            <Button
              variant="danger"
              type="button"
              disabled={deleting}
              onClick={(): void => {
                void remove();
              }}
            >
              {t.savings.confirm}
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={deleting}
              onClick={(): void => setConfirming(false)}
            >
              {t.savings.cancel}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={(): void => onEdit(saving)}
            >
              {t.common.edit}
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={(): void => setConfirming(true)}
            >
              {t.common.delete}
            </Button>
          </>
        )}
      </div>
      <SavingActions savingId={saving.id} />
    </Panel>
  );
}
