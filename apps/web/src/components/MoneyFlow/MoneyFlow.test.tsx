import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { postFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import MovementForm, { billDueDates } from './MovementForm';
import BalanceAdjust from './BalanceAdjust';
import SavingActions from './SavingActions';
import { en } from '@/i18n/messages/en';
import { pt } from '@/i18n/messages/pt';

jest.mock('@/hooks/useAccounts.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [
      { id: 'checking', name: 'Checking' },
      { id: 'payment', name: 'Payment' },
    ],
  }),
}));
jest.mock('@/hooks/useCards.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: [{ id: 'card', name: 'Visa' }] }),
}));
jest.mock('@/hooks/useSavings.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: [{ id: 'saving', name: 'Reserve' }] }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  postFetcher: jest.fn(),
  getFetcher: jest.fn(),
  deleteFetcher: jest.fn(),
}));
jest.mock('@/libs/moneyFlowCache.lib', (): object => ({
  refreshMoneyFlow: jest.fn(),
}));
jest.mock('swr', (): object => ({
  __esModule: true,
  default: (): object => ({ data: undefined, mutate: jest.fn() }),
}));

beforeEach((): void => {
  jest.clearAllMocks();
});

it.each(['en', 'pt'] as const)(
  'shows only the required movement fields in %s',
  (language): void => {
    const labels = language === 'pt' ? pt.moneyFlow : en.moneyFlow;
    renderWithI18n(<MovementForm onClose={jest.fn()} />, { language });
    expect(screen.getByLabelText(labels.from)).toBeInTheDocument();
    expect(screen.getByLabelText(labels.to)).toBeInTheDocument();
    expect(screen.queryByLabelText(labels.card)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(labels.kind), {
      target: { value: 'CARD_BILL_PAYMENT' },
    });
    expect(screen.getByLabelText(labels.card)).toBeInTheDocument();
    expect(screen.getByLabelText(labels.bill)).toBeInTheDocument();
    expect(screen.queryByLabelText(labels.to)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(labels.kind), {
      target: { value: 'INVESTMENT' },
    });
    expect(screen.getByLabelText(labels.saving)).toBeInTheDocument();
    expect(screen.getByLabelText(labels.from)).toBeInTheDocument();
    expect(screen.queryByLabelText(labels.bill)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(labels.opening));
    expect(screen.queryByLabelText(labels.from)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(labels.kind), {
      target: { value: 'REDEMPTION' },
    });
    expect(screen.getByLabelText(labels.to)).toBeInTheDocument();
    expect(screen.queryByLabelText(labels.from)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(labels.opening)).not.toBeInTheDocument();
  }
);

it('records a transfer with API dates and refreshes affected data', async (): Promise<void> => {
  const close = jest.fn();
  renderWithI18n(<MovementForm onClose={close} />);
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-01-10' },
  });
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '100' },
  });
  fireEvent.change(screen.getByLabelText('From account'), {
    target: { value: 'checking' },
  });
  fireEvent.change(screen.getByLabelText('To account'), {
    target: { value: 'payment' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor((): void =>
    expect(postFetcher).toHaveBeenCalledWith('/movements', {
      body: JSON.stringify({
        kind: 'TRANSFER',
        date: '2026/01/10',
        amount: 100,
        fromAccountId: 'checking',
        toAccountId: 'payment',
        cardId: null,
        billDueDate: null,
        savingId: null,
        opening: false,
        notes: null,
      }),
    })
  );
  await waitFor((): void => expect(close).toHaveBeenCalled());
  expect(refreshMoneyFlow).toHaveBeenCalled();
});

it.each(['en', 'pt'] as const)(
  'previews a bank balance difference before saving in %s',
  async (language): Promise<void> => {
    const labels = language === 'pt' ? pt.moneyFlow : en.moneyFlow;
    const common = language === 'pt' ? pt.common : en.common;
    jest.mocked(postFetcher).mockResolvedValue({
      date: '2026/01/31',
      computed: 100,
      balance: 150,
      difference: 50,
      saved: false,
    });
    renderWithI18n(<BalanceAdjust accountId="checking" onClose={jest.fn()} />, {
      language,
    });
    expect(
      screen.queryByRole('button', { name: common.confirm })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(labels.date), {
      target: { value: '2026-01-31' },
    });
    fireEvent.change(screen.getByLabelText(labels.bankBalance), {
      target: { value: '150' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.preview }));
    await waitFor((): void =>
      expect(screen.getByText(new RegExp(labels.difference))).toHaveTextContent(
        '50'
      )
    );
    expect(postFetcher).toHaveBeenCalledWith(
      '/accounts/checking/balance-checkpoints',
      {
        body: JSON.stringify({
          date: '2026/01/31',
          balance: 150,
          preview: true,
        }),
      }
    );
    fireEvent.click(screen.getByRole('button', { name: common.confirm }));
    await waitFor((): void =>
      expect(postFetcher).toHaveBeenLastCalledWith(
        '/accounts/checking/balance-checkpoints',
        {
          body: JSON.stringify({
            date: '2026/01/31',
            balance: 150,
            preview: false,
          }),
        }
      )
    );
  }
);

it.each(['en', 'pt'] as const)(
  'offers saving contributions, redemptions and dated valuations in %s',
  async (language): Promise<void> => {
    const labels = language === 'pt' ? pt.moneyFlow : en.moneyFlow;
    const common = language === 'pt' ? pt.common : en.common;
    renderWithI18n(<SavingActions savingId="saving" />, { language });
    fireEvent.click(screen.getByRole('button', { name: labels.invest }));
    expect(screen.getByLabelText(labels.from)).toBeInTheDocument();
    expect(screen.queryByLabelText(labels.saving)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: labels.redeem }));
    expect(screen.getByLabelText(labels.to)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: labels.value }));
    fireEvent.change(screen.getByLabelText(labels.current), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByLabelText(labels.date), {
      target: { value: '2026-01-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: common.save }));
    await waitFor((): void =>
      expect(postFetcher).toHaveBeenCalledWith('/savings/saving/valuations', {
        body: JSON.stringify({ date: '2026/01/31', value: 120 }),
      })
    );
  }
);

it('lists the card bill due dates around the movement, clamped to short months', (): void => {
  const dueDates = billDueDates(31, new Date(2026, 2, 10)).map(
    (dueDate): string => dueDate.toDateString()
  );
  expect(dueDates).toEqual([
    new Date(2026, 3, 30).toDateString(),
    new Date(2026, 2, 31).toDateString(),
    new Date(2026, 1, 28).toDateString(),
    new Date(2026, 0, 31).toDateString(),
    new Date(2025, 11, 31).toDateString(),
  ]);
});
