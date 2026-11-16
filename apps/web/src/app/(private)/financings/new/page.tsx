'use client';

import {
  Panel,
  TextInput,
  Select,
  Button,
  Field,
  DateField,
  parseFieldDate,
  formatFieldDate,
} from '@/components/ui';
import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  PaymentMethod,
  type Financing,
  type FinancingDraft,
  type FinancingPreview,
} from '@budget-manager/api-client';
import useAccounts from '@/hooks/useAccounts.hook';
import useCategories from '@/hooks/useCategories.hook';
import { TransactionType } from '@/enums';
import { postFetcher } from '@/libs/fetchers.lib';
import { useI18n } from '@/i18n/useI18n';

import { getApiDate, parseApiDate } from '@/utils/globalFormats.util';

export default function NewFinancingPage(): JSX.Element {
  const { t, language } = useI18n();
  const router = useRouter();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories(TransactionType.EXPENSE);
  const [draft, setDraft] = useState<FinancingDraft>({
    name: '',
    kind: 'VEHICLE',
    system: 'PRICE',
    amount: 50000,
    monthlyRate: 0.015,
    term: 36,
    firstDueDate: getApiDate(new Date()),
    categoryId: '',
    paymentMethod: PaymentMethod.BOLETO,
  });
  const [preview, setPreview] = useState<FinancingPreview>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const money = new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
  });
  useEffect((): (() => void) => {
    let active = true;
    const timer = setTimeout((): void => {
      setPreview(undefined);
      void postFetcher<FinancingPreview>('/financings/preview', {
        body: JSON.stringify(draft),
      })
        .then((result): void => {
          if (active) {
            setPreview(result);
            setError('');
          }
        })
        .catch((): void => {
          if (active) setError(t.financing.error);
        });
    }, 350);
    return (): void => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, t.financing.error]);
  function change<Key extends keyof FinancingDraft>(
    key: Key,
    value: FinancingDraft[Key]
  ): void {
    setDraft((previous): FinancingDraft => ({ ...previous, [key]: value }));
  }
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await postFetcher<Financing>('/financings', {
        body: JSON.stringify(draft),
      });
      router.push(`/financings/${saved.id}`);
    } catch {
      setError(t.financing.error);
    } finally {
      setBusy(false);
    }
  }
  const numeric = [
    'amount',
    'term',
    'statedInstallment',
    'insurance',
    'fees',
    'purchasePrice',
    'downPayment',
    'iof',
    'registration',
    'valuationFee',
    'alreadyPaid',
  ] as const;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t.financing.newContract}</h1>
      <Panel
        as="form"
        onSubmit={save}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {(['name', 'lender'] as const).map((key): JSX.Element => (
          <Field label={t.financing[key]} key={key}>
            <TextInput
              required={key === 'name'}
              maxLength={255}
              value={draft[key] ?? ''}
              onChange={(event): void => change(key, event.currentTarget.value)}
            />
          </Field>
        ))}
        <Field label={t.financing.kind}>
          <Select
            value={draft.kind}
            onChange={(event): void =>
              change(
                'kind',
                event.currentTarget.value as FinancingDraft['kind']
              )
            }
          >
            {(['VEHICLE', 'REAL_ESTATE', 'OTHER'] as const).map(
              (kind): JSX.Element => (
                <option key={kind} value={kind}>
                  {t.financing[kind]}
                </option>
              )
            )}
          </Select>
        </Field>
        <Field label={t.financing.system}>
          <Select
            value={draft.system}
            onChange={(event): void => {
              const system = event.currentTarget
                .value as FinancingDraft['system'];
              setDraft((previous): FinancingDraft => ({
                ...previous,
                system,
                statedInstallment: null,
              }));
            }}
          >
            <option value="SAC">SAC</option>
            <option value="PRICE">Price</option>
          </Select>
        </Field>
        {numeric
          .filter(
            (key): boolean =>
              key !== 'statedInstallment' || draft.system === 'PRICE'
          )
          .map((key): JSX.Element => (
            <Field label={t.financing[key]} key={key}>
              <TextInput
                type="number"
                min={0}
                max={key === 'term' ? 500 : undefined}
                step={key === 'term' || key === 'alreadyPaid' ? 1 : '0.01'}
                required={key === 'term' || key === 'amount'}
                value={draft[key] ?? ''}
                onChange={(event): void =>
                  change(
                    key,
                    event.currentTarget.value === ''
                      ? undefined
                      : Number(event.currentTarget.value)
                  )
                }
              />
            </Field>
          ))}
        <Field label={t.financing.monthlyRate}>
          <TextInput
            type="number"
            min={0}
            max={100}
            step="0.0001"
            value={(draft.monthlyRate ?? 0) * 100}
            onChange={(event): void =>
              change('monthlyRate', Number(event.currentTarget.value) / 100)
            }
          />
        </Field>
        <Field label={t.financing.firstDueDate}>
          <DateField
            required

            value={parseFieldDate(draft.firstDueDate.replaceAll('/', '-'))}
            onChange={(pickedDate): void =>
              change(
                'firstDueDate',
                formatFieldDate(pickedDate).replaceAll('-', '/')
              )
            }
          />
        </Field>
        <Field label={t.financing.categoryId}>
          <Select
            required

            value={draft.categoryId}
            onChange={(event): void =>
              change('categoryId', event.currentTarget.value)
            }
          >
            <option value="">—</option>
            {categories?.map((category): JSX.Element => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.financing.paymentMethod}>
          <Select
            value={draft.paymentMethod}
            onChange={(event): void => {
              const paymentMethod = event.currentTarget.value as PaymentMethod;
              setDraft((previous): FinancingDraft => ({
                ...previous,
                paymentMethod,
                accountId: null,
              }));
            }}
          >
            {Object.values(PaymentMethod)
              .filter((method): boolean => method !== PaymentMethod.CREDIT_CARD)
              .map((method): JSX.Element => (
                <option key={method} value={method}>
                  {t.payments.methods[method]}
                </option>
              ))}
          </Select>
        </Field>
        {draft.paymentMethod !== PaymentMethod.CASH &&
          draft.paymentMethod !== PaymentMethod.OTHER && (
            <Field label={t.financing.accountId}>
              <Select
                value={draft.accountId ?? ''}
                onChange={(event): void =>
                  change('accountId', event.currentTarget.value || null)
                }
              >
                <option value="">{t.financing.noAccount}</option>
                {accounts?.map((account): JSX.Element => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        <Button variant="primary" disabled={busy || !preview} type="submit">
          {t.financing.save}
        </Button>
      </Panel>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <Panel>
          <h2>{t.financing.preview}</h2>
          <p>
            {t.financing.effectiveRate}:{' '}
            {(preview.effectiveMonthlyRate * 100).toFixed(4)}%
          </p>
          <p>
            {t.financing.totalInterest}: {money.format(preview.totalInterest)}
          </p>
          <p>
            {t.financing.totalPaid}: {money.format(preview.totalPaid)}
          </p>
          {preview.schedule.slice(0, 3).map((row): JSX.Element => (
            <p key={row.number}>
              {row.number} ·{' '}
              {parseApiDate(row.dueDate).toLocaleDateString(
                language === 'pt' ? 'pt-BR' : 'en-US'
              )}{' '}
              · {money.format(row.payment)}
            </p>
          ))}
        </Panel>
      )}
    </main>
  );
}
