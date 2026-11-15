import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { InvestmentType, SavingLocation } from '@/enums';
import { savingService } from '@/services';
import SavingsPage from '@/app/(private)/savings/page';

jest.mock('@mui/x-charts', (): object => ({
  PieChart: (): null => null,
}));
jest.mock('@/hooks', (): object => ({
  useSavings: (): object => ({
    data: [
      {
        id: 'stock',
        name: 'My shares',
        amount: 100,
        location: SavingLocation.INVESTMENT,
        investmentType: InvestmentType.STOCKS,
      },
      {
        id: 'bond',
        name: 'My CDB',
        amount: 200,
        location: SavingLocation.INVESTMENT,
        investmentType: InvestmentType.CDB,
      },
    ],
    mutate: jest.fn(),
  }),
  useTransactions: (): object => ({ data: [] }),
}));
jest.mock('@/services', (): object => ({
  savingService: { createSaving: jest.fn(), updateSaving: jest.fn() },
}));

beforeEach((): void => {
  jest.clearAllMocks();
});

it('requires a grouped type for investments and omits it for other locations', async (): Promise<void> => {
  renderWithI18n(<SavingsPage />);
  expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue(
    SavingLocation.SAVINGS_ACCOUNT
  );
  expect(
    screen.queryByRole('combobox', { name: 'Investment type' })
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Reserve' },
  });
  fireEvent.change(screen.getByLabelText('Amount (BRL)'), {
    target: { value: '50' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Location' }), {
    target: { value: SavingLocation.INVESTMENT },
  });
  expect(
    screen.getByRole('combobox', { name: 'Investment type' })
  ).toBeRequired();
  expect(
    screen
      .getAllByRole('group')
      .filter((group): boolean => group.tagName === 'OPTGROUP')
  ).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(savingService.createSaving).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox', { name: 'Investment type' }), {
    target: { value: InvestmentType.CDB },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor((): void =>
    expect(savingService.createSaving).toHaveBeenCalledWith({
      name: 'Reserve',
      amount: 50,
      location: SavingLocation.INVESTMENT,
      investmentType: InvestmentType.CDB,
    })
  );
  await waitFor((): void =>
    expect(screen.getByLabelText('Name')).toHaveValue('')
  );
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Cash' },
  });
  fireEvent.change(screen.getByLabelText('Amount (BRL)'), {
    target: { value: '10' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Location' }), {
    target: { value: SavingLocation.INVESTMENT },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Investment type' }), {
    target: { value: InvestmentType.STOCKS },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Location' }), {
    target: { value: SavingLocation.CASH },
  });
  expect(
    screen.queryByRole('combobox', { name: 'Investment type' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor((): void =>
    expect(savingService.createSaving).toHaveBeenLastCalledWith({
      name: 'Cash',
      amount: 10,
      location: SavingLocation.CASH,
    })
  );
});

it('edits the saved type and filters entries by type, clearing it on location changes', async (): Promise<void> => {
  renderWithI18n(<SavingsPage />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
  expect(screen.getByRole('combobox', { name: 'Investment type' })).toHaveValue(
    InvestmentType.STOCKS
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor((): void =>
    expect(savingService.updateSaving).toHaveBeenCalledWith({
      id: 'stock',
      name: 'My shares',
      amount: 100,
      location: SavingLocation.INVESTMENT,
      investmentType: InvestmentType.STOCKS,
    })
  );
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Location' })).getByRole(
      'button',
      { name: 'Investments' }
    )
  );
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Investment type' })).getByRole(
      'button',
      { name: 'Stocks' }
    )
  );
  expect(
    screen.getByRole('heading', { name: 'My shares' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'My CDB' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All locations' }));
  expect(
    screen.queryByRole('group', { name: 'Investment type' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'My CDB' })).toBeInTheDocument();
});
