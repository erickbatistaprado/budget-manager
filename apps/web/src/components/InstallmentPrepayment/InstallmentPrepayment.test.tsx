import { installmentService } from '@/services';
import type { Transaction } from '@/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InstallmentPrepayment from './InstallmentPrepayment.component';

jest.mock('@/services', () => ({
  installmentService: { payEarly: jest.fn(), restore: jest.fn() },
}));

const transaction: Transaction = {
  id: 't1',
  category: {
    id: 'c1',
    name: 'Health',
    transactionType: 'EXPENSE',
  } as Transaction['category'],
  notes: 'Dental Clinic',
  totalValue: 300,
  installmentNumbers: 3,
  repeats: 'NONE' as Transaction['repeats'],
  date: '2026/01/15',
  installments: [
    {
      id: 'a',
      installmentNumber: 1,
      totalInstallments: 3,
      amount: 100,
      dueDate: '2026/01/15',
      paidEarly: false,
    },
    {
      id: 'b',
      installmentNumber: 2,
      totalInstallments: 3,
      amount: 100,
      dueDate: '2026/02/15',
      paidEarly: false,
    },
    {
      id: 'c',
      installmentNumber: 3,
      totalInstallments: 3,
      amount: 100,
      dueDate: '2026/01/20',
      paidEarly: true,
    },
  ],
};

describe('InstallmentPrepayment', (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('pays the chosen installments early on the chosen day', async (): Promise<void> => {
    const onChanged = jest.fn().mockResolvedValue(undefined);
    render(
      <InstallmentPrepayment
        transaction={transaction}
        onChanged={onChanged}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /2\/3/ }));
    fireEvent.change(screen.getByLabelText('Paid on'), {
      target: { value: '01/25/2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pay 1 early/i }));

    await waitFor((): void => expect(onChanged).toHaveBeenCalled());
    expect(installmentService.payEarly).toHaveBeenCalledWith(
      't1',
      [2],
      '2026/01/25'
    );
  });

  it('only offers installments that are not paid early yet', (): void => {
    render(
      <InstallmentPrepayment
        transaction={transaction}
        onChanged={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(
      screen.getByText(/paid on/i, { selector: 'div' })
    ).toBeInTheDocument();
  });

  it('puts a paid-early installment back', async (): Promise<void> => {
    const onChanged = jest.fn().mockResolvedValue(undefined);
    render(
      <InstallmentPrepayment
        transaction={transaction}
        onChanged={onChanged}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor((): void => expect(onChanged).toHaveBeenCalled());
    expect(installmentService.restore).toHaveBeenCalledWith('t1', [3]);
  });

  it('shows the reason when the API refuses', async (): Promise<void> => {
    (installmentService.payEarly as jest.Mock).mockRejectedValueOnce(
      new Error(
        'HTTP 400: {"status":"BAD_REQUEST","message":"a later payment is not an early one"}'
      )
    );
    render(
      <InstallmentPrepayment
        transaction={transaction}
        onChanged={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /1\/3/ }));
    fireEvent.click(screen.getByRole('button', { name: /pay 1 early/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'a later payment is not an early one'
    );
  });
});
