'use client';
import { useState, type JSX, type FormEvent } from 'react';
import {
  PaymentMethod,
  type Goal,
  type GoalPurchaseDraft,
} from '@budget-manager/api-client';
import {
  Button,
  Field,
  NumberInput,
  Select,
  DateField,
  MoneyInput,
} from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import useAccounts from '@/hooks/useAccounts.hook';
import useCards from '@/hooks/useCards.hook';
import useCategories from '@/hooks/useCategories.hook';
import useCurrentUser from '@/hooks/useCurrentUser.hook';
import { TransactionType } from '@/enums';
import { getApiDate } from '@/utils/globalFormats.util';
import { supportsAccount } from '@/utils/payment.util';
export default function PurchaseForm({
  goal,
  busy,
  onSave,
  onCancel,
}: {
  goal: Goal;
  busy: boolean;
  onSave: (draft: GoalPurchaseDraft) => Promise<void>;
  onCancel: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const labels = t.goals;
  const { data: accounts } = useAccounts();
  const { data: cards } = useCards();
  const { data: categories } = useCategories(TransactionType.EXPENSE);
  const { data: user } = useCurrentUser();
  const [price, setPrice] = useState(String(goal.price));
  const [date, setDate] = useState<Date | null>(new Date());
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [account, setAccount] = useState<string | null>(null);
  const [redemptionAccount, setRedemptionAccount] = useState<string | null>(
    null
  );
  const [card, setCard] = useState('');
  const [installments, setInstallments] = useState('1');
  const byCard = method === PaymentMethod.CREDIT_CARD;
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!date) return;
    void onSave({
      price: Number(price),
      date: getApiDate(date),
      categoryId: category,
      paymentMethod: method,
      cardId: byCard ? card : null,
      accountId: supportsAccount(method, false)
        ? (account ?? user?.mainAccountId ?? null)
        : null,
      redemptionAccountId:
        goal.savingId && !byCard && !supportsAccount(method, false)
          ? (redemptionAccount ?? user?.mainAccountId ?? null)
          : null,
      installments:
        byCard && Number(installments) > 1 ? Number(installments) : null,
    });
  }
  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Field label={labels.actualPrice}>
        <MoneyInput
          required
          min="0.01"
          value={price}
          onValueChange={setPrice}
        />
      </Field>
      <DateField required label={labels.date} value={date} onChange={setDate} />
      <Field label={labels.category}>
        <Select
          required
          value={category}
          onChange={(event): void => setCategory(event.currentTarget.value)}
        >
          <option value="">{labels.none}</option>
          {categories?.map((item): JSX.Element => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={labels.payment}>
        <Select
          required
          value={method}
          onChange={(event): void =>
            setMethod(event.currentTarget.value as PaymentMethod)
          }
        >
          {Object.values(PaymentMethod).map((value): JSX.Element => (
            <option key={value} value={value}>
              {t.payments.methods[value]}
            </option>
          ))}
        </Select>
      </Field>
      {supportsAccount(method, false) && (
        <Field label={labels.payAccount}>
          <Select
            required={Boolean(goal.savingId)}
            value={account ?? user?.mainAccountId ?? ''}
            onChange={(event): void => setAccount(event.currentTarget.value)}
          >
            <option value="">{labels.none}</option>
            {accounts?.map((item): JSX.Element => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {goal.savingId && !byCard && !supportsAccount(method, false) && (
        <Field label={labels.redemptionAccount}>
          <Select
            required
            value={redemptionAccount ?? user?.mainAccountId ?? ''}
            onChange={(event): void =>
              setRedemptionAccount(event.currentTarget.value)
            }
          >
            <option value="">{labels.none}</option>
            {accounts?.map((item): JSX.Element => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {byCard && (
        <>
          <Field label={labels.card}>
            <Select
              required
              value={card}
              onChange={(event): void => setCard(event.currentTarget.value)}
            >
              <option value="">{labels.none}</option>
              {cards?.map((item): JSX.Element => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={labels.installments}>
            <NumberInput
              required
              min="1"
              max="500"
              value={installments}
              onChange={(event): void =>
                setInstallments(event.currentTarget.value)
              }
            />
          </Field>
        </>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={busy || !date}>
          {labels.purchase}
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
