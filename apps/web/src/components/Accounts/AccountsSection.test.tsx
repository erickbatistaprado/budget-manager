import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { deleteFetcher } from '@/libs/fetchers.lib';
import AccountsSection from './AccountsSection';
jest.mock('@/hooks/useAccounts.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [{ id: 'nubank', name: 'Nubank account', bank: 'NUBANK' }],
    mutate: jest.fn(),
  }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  deleteFetcher: jest.fn(),
  postFetcher: jest.fn(),
  putFetcher: jest.fn(),
}));
jest.mock('@/libs/transactionsCache.lib', (): object => ({
  refreshTransactions: jest.fn(),
}));
it('requires confirmation to delete an account and supports cancelling', async (): Promise<void> => {
  renderWithI18n(<AccountsSection />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Nubank account');
  expect(deleteFetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor((): void =>
    expect(deleteFetcher).toHaveBeenCalledWith('/accounts/nubank')
  );
});
