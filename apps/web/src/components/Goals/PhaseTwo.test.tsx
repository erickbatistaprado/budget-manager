import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { en } from '@/i18n/messages/en';
import { pt } from '@/i18n/messages/pt';
import NextGoal from './NextGoal';
import PurchaseForm from './PurchaseForm';
import SavingsTips from './SavingsTips';
import SurplusDialog from './SurplusDialog';
import { postFetcher, putFetcher } from '@/libs/fetchers.lib';
import type {
  Goal,
  GoalPlan,
  GoalSavingsTip,
} from '@budget-manager/api-client';
const goal: Goal = {
  id: 'goal',
  name: 'Keyboard',
  price: 1000,
  kind: 'WANT',
  position: 1,
  status: 'ACTIVE',
};
let goals: Goal[] = [goal];
let reservations = 0;
const plan: GoalPlan = {
  pace: 100,
  averagePace: 100,
  paceOverride: null,
  reserved: 400,
  goals: [
    {
      id: 'goal',
      saved: 400,
      remaining: 600,
      expectedMonth: '2027-03',
      late: false,
      extraMonthlyAmount: null,
      firstPositionMonth: null,
    },
  ],
};
const tip: GoalSavingsTip = {
  categoryId: 'delivery',
  category: 'Delivery',
  amount: 900,
  average: 600,
  difference: 300,
  percentAbove: 50,
  goalId: 'goal',
  goalName: 'Keyboard',
  expectedMonth: '2027-03',
  improvedMonth: '2027-01',
  monthsGained: 2,
};
jest.mock('swr', (): object => ({
  __esModule: true,
  default: (key: string | string[]): object => {
    if (Array.isArray(key))
      return {
        data: { goals: { goal: 300 }, investmentAmount: 200, saved: false },
      };
    if (key === '/goals') return { data: goals };
    if (key === '/goals/plan') return { data: plan };
    if (key.startsWith('/goals/month-reservations'))
      return { data: reservations };
    if (key.startsWith('/goals/savings-tips'))
      return { data: [tip], mutate: jest.fn() };
    if (key.startsWith('/movements'))
      return {
        data: [{ kind: 'INVESTMENT', date: '2026/10/10', savingId: 'saving' }],
      };
    return {};
  },
}));
jest.mock('@/hooks/useAccounts.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: [{ id: 'main', name: 'Checking' }] }),
}));
jest.mock('@/hooks/useSavings.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: [{ id: 'saving', name: 'CDB' }] }),
}));
jest.mock('@/hooks/useCurrentUser.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: { mainAccountId: 'main' } }),
}));
jest.mock('@/hooks/useCards.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: [{ id: 'card', name: 'Card' }] }),
}));
jest.mock('@/hooks/useCategories.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [{ id: 'delivery', name: 'Delivery', fixedCost: false }],
    mutate: jest.fn(),
  }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  getFetcher: jest.fn(),
  postFetcher: jest.fn(),
  putFetcher: jest.fn(),
}));
jest.mock('@/libs/moneyFlowCache.lib', (): object => ({
  refreshMoneyFlow: jest.fn(),
}));
beforeAll((): void => {
  HTMLDialogElement.prototype.showModal = function (): void {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (): void {
    this.removeAttribute('open');
  };
});
beforeEach((): void => {
  jest.clearAllMocks();
  goals = [goal];
  reservations = 0;
  jest.mocked(postFetcher).mockResolvedValue(undefined);
});
it.each(['en', 'pt'] as const)(
  'shows next goal and empty invitation in %s',
  (language): void => {
    const labels = { en, pt }[language].goals;
    const { unmount } = renderWithI18n(<NextGoal />, { language });
    expect(
      screen.getByRole('heading', { name: labels.next })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { value: { now: 40 } })
    ).toBeInTheDocument();
    expect(screen.getByText(/2027/)).toBeInTheDocument();
    unmount();
    goals = [];
    renderWithI18n(<NextGoal />, { language });
    expect(screen.getByRole('link', { name: labels.new })).toHaveAttribute(
      'href',
      '/goals?new=1'
    );
  }
);
it.each(['en', 'pt'] as const)(
  'previews split, edits, refuses over-limit and confirms in %s',
  async (language): Promise<void> => {
    const labels = { en, pt }[language].goals;
    renderWithI18n(
      <SurplusDialog
        draft={{ date: '2026/10/31', amount: 500, fromAccountId: 'main' }}
        onClose={jest.fn()}
      />,
      { language }
    );
    expect(screen.getByLabelText('Keyboard')).toHaveValue(300);
    expect(screen.getByLabelText(labels.investment)).toHaveValue(200);
    expect(screen.getByLabelText(labels.investInto)).toHaveValue('saving');
    fireEvent.change(screen.getByLabelText('Keyboard'), {
      target: { value: '400' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(labels.overLimit);
    expect(screen.getByRole('button', { name: labels.submit })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(labels.investment), {
      target: { value: '100' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.submit }));
    await waitFor((): void =>
      expect(postFetcher).toHaveBeenCalledWith('/goals/allocate', {
        body: JSON.stringify({
          date: '2026/10/31',
          amount: 500,
          fromAccountId: 'main',
          preview: false,
          allocations: { goal: 400 },
        }),
      })
    );
    await waitFor((): void =>
      expect(postFetcher).toHaveBeenCalledWith(
        '/movements',
        expect.objectContaining({
          body: expect.stringContaining('"amount":100'),
        })
      )
    );
  }
);
it.each(['en', 'pt'] as const)(
  'uses transaction payment rules and installments in %s',
  async (language): Promise<void> => {
    const labels = { en, pt }[language].goals;
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderWithI18n(
      <PurchaseForm
        goal={goal}
        busy={false}
        onSave={onSave}
        onCancel={jest.fn()}
      />,
      { language }
    );
    expect(screen.getByLabelText(labels.payAccount)).toHaveValue('main');
    fireEvent.change(screen.getByLabelText(labels.category), {
      target: { value: 'delivery' },
    });
    fireEvent.change(screen.getByLabelText(labels.payment), {
      target: { value: 'CREDIT_CARD' },
    });
    expect(screen.queryByLabelText(labels.payAccount)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(labels.card), {
      target: { value: 'card' },
    });
    fireEvent.change(screen.getByLabelText(labels.installments), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.purchase }));
    await waitFor((): void =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 1000,
          categoryId: 'delivery',
          paymentMethod: 'CREDIT_CARD',
          cardId: 'card',
          accountId: null,
          installments: 3,
        })
      )
    );
  }
);
it.each(['en', 'pt'] as const)(
  'shows tips and edits fixed categories in %s',
  async (language): Promise<void> => {
    const labels = { en, pt }[language].goals;
    renderWithI18n(<SavingsTips />, { language });
    expect(
      screen.getByRole('heading', { name: labels.tips })
    ).toBeInTheDocument();
    expect(screen.getByText(labels.gained('Keyboard', 2))).toBeInTheDocument();
    fireEvent.click(screen.getByText(labels.settings));
    fireEvent.click(screen.getByLabelText(`Delivery · ${labels.fixedCost}`));
    await waitFor((): void =>
      expect(putFetcher).toHaveBeenCalledWith(
        '/categories/delivery/fixed-cost',
        { body: JSON.stringify({ fixedCost: true }) }
      )
    );
  }
);

it('subtracts existing reservations before confirming a split', async (): Promise<void> => {
  reservations = 100;
  renderWithI18n(
    <SurplusDialog
      draft={{ date: '2026/10/31', amount: 500, fromAccountId: 'main' }}
      onClose={jest.fn()}
    />
  );
  expect(screen.getByRole('button', { name: en.goals.submit })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(en.goals.investment), {
    target: { value: '100' },
  });
  fireEvent.click(screen.getByRole('button', { name: en.goals.submit }));
  await waitFor((): void =>
    expect(postFetcher).toHaveBeenCalledWith(
      '/goals/allocate',
      expect.objectContaining({ body: expect.stringContaining('"amount":400') })
    )
  );
});

it('retries a failed investment without allocating goals twice', async (): Promise<void> => {
  jest
    .mocked(postFetcher)
    .mockImplementation(async (path: string): Promise<undefined> => {
      if (path === '/movements') throw new Error('Offline');
      return undefined;
    });
  renderWithI18n(
    <SurplusDialog
      draft={{ date: '2026/10/31', amount: 500, fromAccountId: 'main' }}
      onClose={jest.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: en.goals.submit }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    en.goals.investmentError
  );
  jest.mocked(postFetcher).mockResolvedValue(undefined);
  fireEvent.click(
    screen.getByRole('button', { name: en.goals.retryInvestment })
  );
  await waitFor((): void =>
    expect(
      jest
        .mocked(postFetcher)
        .mock.calls.filter((call): boolean => call[0] === '/movements')
    ).toHaveLength(2)
  );
  expect(
    jest
      .mocked(postFetcher)
      .mock.calls.filter((call): boolean => call[0] === '/goals/allocate')
  ).toHaveLength(1);
});

it('keeps cash expenses unassigned while selecting a redemption account', async (): Promise<void> => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  renderWithI18n(
    <PurchaseForm
      goal={{ ...goal, savingId: 'saving' }}
      busy={false}
      onSave={onSave}
      onCancel={jest.fn()}
    />
  );
  fireEvent.change(screen.getByLabelText(en.goals.category), {
    target: { value: 'delivery' },
  });
  fireEvent.change(screen.getByLabelText(en.goals.payment), {
    target: { value: 'CASH' },
  });
  expect(screen.getByLabelText(en.goals.redemptionAccount)).toHaveValue('main');
  fireEvent.click(screen.getByRole('button', { name: en.goals.purchase }));
  await waitFor((): void =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: 'CASH',
        accountId: null,
        redemptionAccountId: 'main',
      })
    )
  );
});
