import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { deleteFetcher, postFetcher, putFetcher } from '@/libs/fetchers.lib';
import CardsPage from './page';

jest.mock('@/libs/transactionsCache.lib', (): object => ({
  refreshTransactions: jest.fn(),
}));

jest.mock('@/hooks/useAccounts.hook', (): object => ({
  __esModule: true,
  default: (): object => ({ data: [], mutate: jest.fn() }),
}));

jest.mock('@/hooks/useCards.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [
      {
        id: 'visa',
        name: 'Visa',
        closingDay: 25,
        dueDay: 5,
        creditLimit: 50000,
        usedLimit: 10000,
        availableLimit: 40000,
      },
    ],
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

it.each(['en', 'pt'] as const)(
  'saves optional positive limits in %s',
  async (language): Promise<void> => {
    renderWithI18n(<CardsPage />, { language });
    const limit = screen.getByRole('spinbutton', {
      name: language === 'pt' ? 'Limite' : 'Credit limit',
    });
    expect(limit).not.toBeRequired();
    fireEvent.change(
      screen.getAllByLabelText(language === 'pt' ? 'Nome' : 'Name')[0],
      { target: { value: 'New card' } }
    );
    fireEvent.change(limit, { target: { value: '0' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Adicionar cartão' : 'Add card',
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      language === 'pt'
        ? 'Informe um limite positivo'
        : 'Enter a positive credit limit'
    );
    expect(postFetcher).not.toHaveBeenCalled();
    fireEvent.change(limit, { target: { value: '50000' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Adicionar cartão' : 'Add card',
      })
    );
    await waitFor((): void =>
      expect(postFetcher).toHaveBeenCalledWith(
        '/cards',
        expect.objectContaining({
          body: expect.stringContaining('"creditLimit":50000'),
        })
      )
    );
    await waitFor((): void => expect(limit).toHaveValue(null));
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Editar' : 'Edit',
      })
    );
    expect(limit).toHaveValue(50000);
    fireEvent.change(limit, { target: { value: '' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Salvar' : 'Save',
      })
    );
    await waitFor((): void =>
      expect(putFetcher).toHaveBeenCalledWith(
        '/cards/visa',
        expect.objectContaining({
          body: expect.stringContaining('"creditLimit":null'),
        })
      )
    );
  }
);
