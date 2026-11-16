'use client';
import { Button, IconButton, EntryRow } from '@/components/ui';
import { useState, type JSX } from 'react';
import type { Movement, MovementDraft } from '@budget-manager/api-client';
import { useI18n } from '@/i18n/useI18n';
import { formatBRL } from '@/utils/analytics.util';
import { formatDate, parseApiDate } from '@/utils/globalFormats.util';
import { deleteFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import { BiEdit } from 'react-icons/bi';
import { FcFullTrash } from 'react-icons/fc';
import MovementForm from '@/components/MoneyFlow/MovementForm';

export default function MovementRow({
  movement,
  names,
  onRecord,
  table = false,
}: {
  table?: boolean;
  movement: Movement;
  names: Record<string, string>;
  onRecord: (draft: Partial<MovementDraft>) => void;
}): JSX.Element {
  const { t, language } = useI18n();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  async function remove(): Promise<void> {
    if (!movement.id) return;
    setBusy(true);
    try {
      await deleteFetcher(`/movements/${movement.id}`);
      await refreshMoneyFlow();
    } catch {
      setError(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }
  const icons = {
    TRANSFER: '↔',
    CARD_BILL_PAYMENT: '▣',
    INVESTMENT: '↗',
    REDEMPTION: '↙',
  };
  const Container = table ? 'tbody' : 'div';
  const ExtraRow = table ? 'tr' : 'div';
  const ExtraCell = table ? 'td' : 'div';
  return (
    <Container className="min-w-0">
      <EntryRow
        table={table}
        icon={icons[movement.kind]}
        description={movement.notes || t.moneyFlow[movement.kind]}
        detail={
          <>
            {movement.paymentMethod &&
              `${t.payments.methods[movement.paymentMethod]} · `}
            {names[movement.fromAccountId ?? ''] ?? '—'} →{' '}
            {names[
              movement.toAccountId ?? movement.savingId ?? movement.cardId ?? ''
            ] ?? '—'}
          </>
        }
        date={
          <>
            {formatDate(parseApiDate(movement.date), language)}
            <span className="block text-xs text-[var(--ctp-subtext0)]">
              {movement.automatic
                ? t.moneyFlow.automatic
                : t.moneyFlow.recorded}
            </span>
          </>
        }
        amount={formatBRL(movement.amount, language)}
        actions={
          <>
            {movement.automatic ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={(): void => onRecord(movement)}
              >
                {t.dashboard.record}
              </Button>
            ) : (
              <>
                <IconButton
                  variant="ghost"
                  aria-label={t.common.edit}
                  onClick={(): void => setEditing(true)}
                >
                  <BiEdit size={20} />
                </IconButton>
                {confirming ? (
                  <>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={(): void => {
                        void remove();
                      }}
                    >
                      {t.common.confirm}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={(): void => setConfirming(false)}
                    >
                      {t.common.cancel}
                    </Button>
                  </>
                ) : (
                  <IconButton
                    variant="ghost"
                    aria-label={t.common.delete}
                    disabled={busy}
                    onClick={(): void => setConfirming(true)}
                  >
                    <FcFullTrash size={20} />
                  </IconButton>
                )}
              </>
            )}
          </>
        }
      />
      {(editing || Boolean(error)) && (
        <ExtraRow>
          <ExtraCell colSpan={table ? 5 : undefined}>
            {editing && movement.id && (
              <MovementForm
                movementId={movement.id}
                initialKind={movement.kind}
                initialDraft={movement}
                onClose={(): void => setEditing(false)}
              />
            )}
            {error && <p role="alert">{error}</p>}
          </ExtraCell>
        </ExtraRow>
      )}
    </Container>
  );
}
