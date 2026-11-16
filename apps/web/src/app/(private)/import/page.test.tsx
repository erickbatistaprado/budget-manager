import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { statementImportService } from '@/services';
import type { StatementPreview } from '@budget-manager/api-client';
import ImportPage from './page';

jest.mock('@/hooks', (): object => ({
  useCategories: (): object => ({
    data: [{ id: 'food', name: 'Food', transactionType: 'EXPENSE' }],
    mutate: jest.fn(),
  }),
}));
jest.mock('@/hooks/useCards.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [{ id: 'visa', name: 'Visa', closingDay: 25, dueDay: 5 }],
  }),
}));
jest.mock('@/libs/transactionsCache.lib', (): object => ({
  refreshTransactions: jest.fn(),
}));
jest.mock('@/services', (): object => ({
  PASSWORD_REQUIRED_STATUS: 423,
  StatementImportError: class extends Error {},
  statementImportService: { preview: jest.fn(), importLines: jest.fn() },
}));
beforeEach((): void => {
  jest.clearAllMocks();
});
const statement: StatementPreview = {
  source: 'BRADESCO_CARD_PDF',
  billDueDate: '2027/01/05',
  statementDate: '2026/12/14',
  totalsMatch: true,
  lines: [
    {
      index: 0,
      date: '2026/12/12',
      description: 'Shop',
      amount: 30,
      credit: false,
      paidEarly: false,
      suggestedCategoryId: 'food',
      suggestionCount: 0,
      merchantKey: 'shop',
      duplicate: false,
      selected: true,
    },
  ],
};
it('prefills the printed date and sends card and bill date with the import', async (): Promise<void> => {
  jest.mocked(statementImportService.preview).mockResolvedValue(statement);
  jest.mocked(statementImportService.importLines).mockResolvedValue({
    imported: 1,
    skippedAsDuplicates: 0,
    movedInstallments: 0,
    billDatesSet: 2,
  });
  renderWithI18n(<ImportPage />);
  fireEvent.change(screen.getByLabelText('Statement file'), {
    target: { files: [new File(['synthetic'], 'bill.pdf')] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Read statement' }));
  await waitFor((): void =>
    expect(screen.getByLabelText('Bill due date')).toHaveValue('01/05/2027')
  );
  fireEvent.change(screen.getByLabelText('Card'), {
    target: { value: 'visa' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Import 1/ }));
  await waitFor((): void =>
    expect(statementImportService.importLines).toHaveBeenCalledWith(
      expect.any(Array),
      'visa',
      '2027/01/05'
    )
  );
  expect(
    await screen.findByText('moved 2 to their bill month', { exact: false })
  ).toBeInTheDocument();
});
it('defaults an open bill from its export date after a card is selected', async (): Promise<void> => {
  jest
    .mocked(statementImportService.preview)
    .mockResolvedValue({ ...statement, billDueDate: null });
  renderWithI18n(<ImportPage />);
  fireEvent.change(screen.getByLabelText('Statement file'), {
    target: { files: [new File(['synthetic'], 'open.pdf')] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Read statement' }));
  await screen.findByLabelText('Card');
  fireEvent.change(screen.getByLabelText('Card'), {
    target: { value: 'visa' },
  });
  expect(screen.getByLabelText('Bill due date')).toHaveValue('01/05/2027');
});

it('can apply a bill date when every line is already saved', async (): Promise<void> => {
  jest.mocked(statementImportService.preview).mockResolvedValue({
    ...statement,
    lines: statement.lines.map((line): StatementPreview['lines'][number] => ({
      ...line,
      duplicate: true,
      selected: false,
      duplicateOfTransactionId: 'saved',
    })),
  });
  jest.mocked(statementImportService.importLines).mockResolvedValue({
    imported: 0,
    skippedAsDuplicates: 1,
    movedInstallments: 0,
    billDatesSet: 1,
  });
  renderWithI18n(<ImportPage />);
  fireEvent.change(screen.getByLabelText('Statement file'), {
    target: { files: [new File(['synthetic'], 'old.pdf')] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Read statement' }));
  const apply = await screen.findByRole('button', {
    name: 'Apply bill date to saved purchases',
  });
  expect(apply).toBeEnabled();
  fireEvent.click(apply);
  await waitFor((): void =>
    expect(statementImportService.importLines).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ description: 'Shop' }),
      ]),
      undefined,
      '2027/01/05'
    )
  );
});
