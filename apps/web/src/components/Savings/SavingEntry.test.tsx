import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { SavingLocation } from '@/enums';
import SavingEntry from './SavingEntry';

it('only deletes after confirmation, and allows cancellation', async (): Promise<void> => {
  const onDelete = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  renderWithI18n(
    <SavingEntry
      saving={{
        id: 'cash',
        name: 'Wallet',
        amount: 100,
        location: SavingLocation.CASH,
      }}
      total={100}
      today={new Date(2026, 10, 14)}
      onEdit={jest.fn()}
      onDelete={onDelete}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onDelete).not.toHaveBeenCalled();
  expect(screen.getByText('Delete this entry?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByText('Delete this entry?')).not.toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
  await waitFor((): void => expect(onDelete).toHaveBeenCalledWith('cash'));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
