import { Bank, bankDisplayNames } from '@budget-manager/api-client';
import { bankColors } from '@/utils/payment.util';
import { useI18n } from '@/i18n/useI18n';
import type { JSX } from 'react';
export function BankSelect({
  bank,
  onChange,
}: {
  bank: Bank;
  onChange: (bank: Bank) => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <label className="flex flex-col gap-1">
      {t.payments.bank}
      <select
        className="rounded border border-[var(--ctp-surface2)] bg-[var(--ctp-base)] p-2"
        value={bank}
        onChange={(event): void => onChange(event.currentTarget.value as Bank)}
      >
        {Object.values(Bank).map((value): JSX.Element => (
          <option key={value} value={value}>
            {value === Bank.OTHER
              ? t.payments.methods.OTHER
              : bankDisplayNames[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
export function BankBadge({ bank }: { bank: Bank }): JSX.Element {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 text-sm text-[var(--ctp-subtext1)]">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full ring-1 ring-[var(--ctp-overlay0)]"
        style={{ backgroundColor: bankColors[bank] ?? '#888888' }}
      />
      {bank === Bank.OTHER ? t.payments.methods.OTHER : bankDisplayNames[bank]}
    </span>
  );
}
