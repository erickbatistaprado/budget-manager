'use client';

import { Money } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import { installmentService } from '@/services';
import type { Installment, Transaction } from '@/types';
import { formatDate } from '@/utils/globalFormats.util';
import { toApiDate, todayInputValue } from '@/utils/installments.util';
import clsx from 'clsx';
import { useState, type ChangeEvent, type JSX } from 'react';

export interface InstallmentPrepaymentProps {
  transaction: Transaction;
  onChanged: () => Promise<unknown>;
  onClose: () => void;
}

function byNumber(left: Installment, right: Installment): number {
  return left.installmentNumber - right.installmentNumber;
}

/**
 * Marks installments the card prepaid: they move to the day they were paid, so the month they were
 * paid in shows them and later months no longer do. Paid-early installments can be put back.
 */
export default function InstallmentPrepayment({
  transaction,
  onChanged,
  onClose,
}: Readonly<InstallmentPrepaymentProps>): JSX.Element {
  const { language, t } = useI18n();
  const installments: Installment[] = [
    ...(transaction.installments ?? []),
  ].sort(byNumber);
  const pending: Installment[] = installments.filter(
    (installment: Installment): boolean => !installment.paidEarly
  );
  const paidEarly: Installment[] = installments.filter(
    (installment: Installment): boolean => installment.paidEarly
  );
  const [chosen, setChosen] = useState<number[]>([]);
  const [paidOn, setPaidOn] = useState<string>(todayInputValue());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  function toggle(number: number): void {
    setChosen((current: number[]): number[] =>
      current.includes(number)
        ? current.filter((value: number): boolean => value !== number)
        : [...current, number]
    );
  }

  async function run(action: () => Promise<unknown>): Promise<void> {
    setErrorMessage('');
    setIsSaving(true);
    try {
      await action();
      setChosen([]);
      await onChanged();
    } catch (error: unknown) {
      const text: string = error instanceof Error ? error.message : '';
      const message: RegExpMatchArray | null = /"message":"([^"]+)"/.exec(text);
      setErrorMessage(message?.[1] ?? t.prepayment.error);
    } finally {
      setIsSaving(false);
    }
  }

  const canPay: boolean = chosen.length > 0 && Boolean(paidOn) && !isSaving;

  return (
    <div
      role="dialog"
      aria-label={t.prepayment.title}
      className="col-span-4 my-2 flex flex-col gap-3 rounded border border-[var(--ctp-surface1)] bg-[var(--ctp-surface0)] p-3 text-sm"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[var(--ctp-text)]">
          {t.prepayment.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded px-2 py-1 text-[var(--ctp-subtext1)] hover:bg-[var(--ctp-surface1)]"
        >
          {t.common.close}
        </button>
      </div>
      <p className="text-xs text-[var(--ctp-subtext0)]">
        {t.prepayment.description}
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {pending.map((installment: Installment): JSX.Element => (
          <label
            key={installment.installmentNumber}
            className="flex items-center gap-2 text-[var(--ctp-text)]"
          >
            <input
              type="checkbox"
              checked={chosen.includes(installment.installmentNumber)}
              onChange={(): void => toggle(installment.installmentNumber)}
            />
            {installment.installmentNumber}/{installment.totalInstallments} ·{' '}
            {formatDate(installment.dueDate, language)}
            <Money
              className="text-[var(--ctp-subtext1)]"
              value={Number(installment.amount)}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[var(--ctp-text)]">
          {t.prepayment.paidOn}
          <input
            type="date"
            aria-label={t.prepayment.paidOn}
            value={paidOn}
            onChange={({
              currentTarget: { value },
            }: ChangeEvent<HTMLInputElement>): void => setPaidOn(value)}
            className="rounded-md border border-[var(--ctp-surface1)] bg-[var(--ctp-base)] px-2 py-1 text-[var(--ctp-text)]"
          />
        </label>
        <button
          type="button"
          disabled={!canPay}
          onClick={(): Promise<void> =>
            run(() =>
              installmentService.payEarly(
                transaction.id,
                chosen,
                toApiDate(paidOn)
              )
            )
          }
          className={clsx(
            'rounded-md px-3 py-1 font-medium',
            canPay
              ? 'cursor-pointer bg-[var(--ctp-blue)] text-[var(--ctp-crust)] hover:bg-[var(--ctp-lavender)]'
              : 'cursor-not-allowed bg-[var(--ctp-surface2)] text-[var(--ctp-subtext0)]'
          )}
        >
          {isSaving
            ? t.common.saving
            : t.prepayment.payEarlyButton(chosen.length)}
        </button>
      </div>
      {paidEarly.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-[var(--ctp-surface1)] pt-2">
          <span className="text-xs text-[var(--ctp-subtext0)]">
            {t.prepayment.paidEarlyHeader}
          </span>
          {paidEarly.map((installment: Installment): JSX.Element => (
            <div
              key={installment.installmentNumber}
              className="flex items-center gap-2 text-[var(--ctp-text)]"
            >
              {installment.installmentNumber}/{installment.totalInstallments} ·{' '}
              {t.prepayment.paidOnDate(
                formatDate(installment.dueDate, language)
              )}
              <button
                type="button"
                disabled={isSaving}
                onClick={(): Promise<void> =>
                  run(() =>
                    installmentService.restore(transaction.id, [
                      installment.installmentNumber,
                    ])
                  )
                }
                className="cursor-pointer rounded px-2 py-0.5 text-[var(--ctp-blue)] hover:bg-[var(--ctp-surface1)]"
              >
                {t.common.undo}
              </button>
            </div>
          ))}
        </div>
      )}
      {errorMessage && (
        <span role="alert" className="text-[var(--ctp-red)]">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
