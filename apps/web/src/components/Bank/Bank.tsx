import { Select, Field, Badge } from '@/components/ui';
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
    <Field label={t.payments.bank}>
      <Select
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
      </Select>
    </Field>
  );
}
export function BankBadge({ bank }: { bank: Bank }): JSX.Element {
  const { t } = useI18n();
  return (
    <Badge>
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full ring-1 ring-[var(--ctp-overlay0)]"
        style={{ backgroundColor: bankColors[bank] ?? '#888888' }}
      />
      {bank === Bank.OTHER ? t.payments.methods.OTHER : bankDisplayNames[bank]}
    </Badge>
  );
}
