import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { deleteFetcher } from '@/libs/fetchers.lib';
import CardsPage from './page';

jest.mock('@/libs/transactionsCache.lib', (): object => ({
  refreshTransactions: jest.fn(),
}));

jest.mock('@/hooks/useCards.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [{ id: 'visa', name: 'Visa', closingDay: 25, dueDay: 5 }],
    mutate: jest.fn(),
  }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  deleteFetcher: jest.fn(),
  postFetcher: jest.fn(),
  putFetcher: jest.fn(),
}));
beforeEach((): void => {
  jest.clearAllMocks();
});

it('requires confirmation before deleting a card and supports cancelling', async (): Promise<void> => {
  renderWithI18n(<CardsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(deleteFetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor((): void =>
    expect(deleteFetcher).toHaveBeenCalledWith('/cards/visa')
  );
});
it('validates days inline', (): void => {
  renderWithI18n(<CardsPage />);
  fireEvent.change(screen.getByLabelText('Closing day'), {
    target: { value: '32' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Enter a name and whole days between 1 and 31.'
  );
});
