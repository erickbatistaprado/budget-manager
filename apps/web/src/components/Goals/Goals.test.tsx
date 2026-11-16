import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { en } from '@/i18n/messages/en';
import { pt } from '@/i18n/messages/pt';
import { deleteFetcher, postFetcher, putFetcher } from '@/libs/fetchers.lib';
import { refreshMoneyFlow } from '@/libs/moneyFlowCache.lib';
import GoalsPage from '@/app/(private)/goals/page';
import type { Goal, GoalPlan } from '@budget-manager/api-client';

const mockGoals: Goal[] = [
  {
    id: 'trip',
    name: 'Trip to NY',
    price: 1000,
    kind: 'WANT',
    link: 'https://example.com',
    notes: 'Flight and hotel',
    targetDate: '2027/07/01',
    position: 1,
    monthlyAmount: 200,
    savingId: 'cdb',
    status: 'ACTIVE',
  },
  {
    id: 'keyboard',
    name: 'Keyboard',
    price: 500,
    kind: 'NEED',
    link: null,
    notes: null,
    targetDate: '2027/07/01',
    position: 2,
    monthlyAmount: null,
    savingId: null,
    status: 'ACTIVE',
  },
];

const mockPlan: GoalPlan = {
  pace: 300,
  averagePace: 300,
  paceOverride: null,
  reserved: 100,
  goals: [
    {
      id: 'trip',
      saved: 400,
      remaining: 600,
      expectedMonth: '2027-03',
      late: false,
      extraMonthlyAmount: null,
      firstPositionMonth: null,
    },
    {
      id: 'keyboard',
      saved: 100,
      remaining: 400,
      expectedMonth: '2027-09',
      late: true,
      extraMonthlyAmount: 300,
      firstPositionMonth: '2027-01',
    },
  ],
};

let currentGoals = mockGoals;
let currentPlan = mockPlan;

jest.mock('swr', (): object => ({
  __esModule: true,
  default: (key: string): object => {
    if (key === '/goals') {
      return { data: currentGoals, mutate: jest.fn() };
    }
    if (key === '/goals/plan') {
      return { data: currentPlan, mutate: jest.fn() };
    }
    return { data: undefined, mutate: jest.fn() };
  },
}));
jest.mock('@/hooks/useSavings.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [{ id: 'cdb', name: 'CDB Trip' }],
  }),
}));
jest.mock('@/hooks/useAccounts.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [
      { id: 'main', name: 'Main Checking', balance: 1500 },
      { id: 'other', name: 'Other Account', balance: 500 },
    ],
  }),
}));
jest.mock('@/hooks/useCurrentUser.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: { id: 'owner', mainAccountId: 'main' },
  }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  getFetcher: jest.fn(),
  postFetcher: jest.fn(),
  putFetcher: jest.fn(),
  deleteFetcher: jest.fn(),
}));
jest.mock('@/libs/moneyFlowCache.lib', (): object => ({
  refreshMoneyFlow: jest.fn(),
}));

beforeEach((): void => {
  jest.clearAllMocks();
  currentGoals = mockGoals;
  currentPlan = mockPlan;
  jest.mocked(postFetcher).mockResolvedValue(undefined);
  jest.mocked(putFetcher).mockResolvedValue(undefined);
  jest.mocked(deleteFetcher).mockResolvedValue(undefined);
  jest.mocked(refreshMoneyFlow).mockResolvedValue(undefined);
});

it.each(['en', 'pt'] as const)(
  'renders ranked goals, warning text, pace override, keyboard reorder, goal form and allocation in %s',
  async (language): Promise<void> => {
    const labels = language === 'pt' ? pt.goals : en.goals;
    renderWithI18n(<GoalsPage />, { language });

    expect(
      screen.getByRole('heading', { name: labels.title })
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(labels.average))).toBeInTheDocument();
    expect(screen.getByText(/CDB Trip/)).toBeInTheDocument();
    expect(
      screen.getByText(
        language === 'pt'
          ? /Não fica pronta até.*300,00\/mês a mais resolve; ou suba para 1º/
          : /Not ready by.*300\.00\/month more gets you there; or move it to 1st place/
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: `${labels.moveUp}: Keyboard` })
    );
    await waitFor((): void =>
      expect(putFetcher).toHaveBeenCalledWith('/goals/keyboard/position', {
        body: JSON.stringify({ position: 1 }),
      })
    );

    fireEvent.change(screen.getByLabelText(labels.monthly), {
      target: { value: '450' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.submit }));
    await waitFor((): void =>
      expect(putFetcher).toHaveBeenCalledWith('/goals/pace', {
        body: JSON.stringify({ monthlyAmount: 450 }),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: labels.new }));
    fireEvent.change(screen.getByLabelText(labels.name), {
      target: { value: 'New Hardware' },
    });
    fireEvent.change(screen.getByLabelText(labels.price), {
      target: { value: '800' },
    });
    fireEvent.change(screen.getByLabelText(labels.kind), {
      target: { value: 'NEED' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: labels.submit })[1]);
    await waitFor((): void =>
      expect(postFetcher).toHaveBeenCalledWith('/goals', {
        body: JSON.stringify({
          name: 'New Hardware',
          price: 800,
          kind: 'NEED',
          targetDate: null,
          monthlyAmount: null,
          savingId: null,
          link: null,
          notes: null,
        }),
      })
    );

    fireEvent.click(screen.getAllByRole('button', { name: labels.save })[0]);
    expect(screen.getByLabelText(labels.account)).toHaveValue('main');
    fireEvent.change(screen.getByLabelText(labels.amount), {
      target: { value: '150' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: labels.save })[0]);
    await waitFor((): void =>
      expect(postFetcher).toHaveBeenCalledWith(
        '/goals/trip/allocations',
        expect.objectContaining({
          body: expect.stringContaining('"fromAccountId":"main"'),
        })
      )
    );
  }
);

it('shows the empty state and resets pace override', async (): Promise<void> => {
  currentGoals = [];
  currentPlan = { ...mockPlan, paceOverride: 450, goals: [] };
  renderWithI18n(<GoalsPage />, { language: 'pt' });
  expect(screen.getByText(pt.goals.empty)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: pt.goals.reset }));
  await waitFor((): void =>
    expect(putFetcher).toHaveBeenCalledWith('/goals/pace', {
      body: JSON.stringify({ monthlyAmount: null }),
    })
  );
});

it.each(['en', 'pt'] as const)(
  'keeps achieved goals collapsed and outside the ranking in %s',
  (language): void => {
    const labels = { en, pt }[language].goals;
    currentGoals = [
      ...mockGoals,
      {
        ...mockGoals[0],
        id: 'done',
        name: 'Bought keyboard',
        status: 'ACHIEVED',
        savedAtPurchase: 400,
        actualPrice: 350,
        achievedAt: '2026/10/10',
      },
    ];
    renderWithI18n(<GoalsPage />, { language });
    expect(screen.getByText('Bought keyboard')).not.toBeVisible();
    expect(screen.getByText('Bought keyboard')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: labels.purchase })
    ).toHaveLength(2);
  }
);
