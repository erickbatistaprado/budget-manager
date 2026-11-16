/* eslint-disable testing-library/no-node-access -- The notch and floating state are deliberately hidden from accessibility queries. */
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  Select,
  TextInput,
  NumberInput,
  DateField,
  ProgressBar,
} from './index';
it('retains native select form behavior and exact label text in its notch', (): void => {
  render(
    <form aria-label="Entry">
      <Select
        label="Account"
        name="account"
        defaultValue=""
        required
        helperText="Choose an account"
      >
        <option value="">Select…</option>
        <option value="cash">Cash</option>
      </Select>
    </form>
  );
  const select = screen.getByRole('combobox', { name: 'Account' });
  const frame = select.closest('.outlined-field');
  expect(frame).toHaveAttribute('data-filled', 'false');
  expect(screen.getByText('Choose an account')).toHaveAttribute(
    'id',
    select.getAttribute('aria-describedby')
  );
  expect(select).toBeRequired();
  fireEvent.focus(select);
  expect(frame).toHaveAttribute('data-floating', 'true');
  fireEvent.blur(select);
  expect(frame).toHaveAttribute('data-floating', 'false');
  fireEvent.focus(select);
  expect(
    select.closest('.outlined-box')?.querySelector('legend')
  ).toHaveTextContent('Account *');
  fireEvent.change(select, { target: { value: 'cash' } });
  fireEvent.blur(select);
  expect(frame).toHaveAttribute('data-filled', 'true');
  expect(frame).toHaveAttribute('data-floating', 'true');
  expect(
    new FormData(screen.getByRole('form') as HTMLFormElement).get('account')
  ).toBe('cash');
  fireEvent.change(select, { target: { value: '' } });
  expect(frame).toHaveAttribute('data-filled', 'false');
});
it('connects outlined errors, helper text, disabled and size', (): void => {
  render(
    <TextInput
      label="Amount"
      error
      helperText="Invalid amount"
      disabled
      size="small"
      fullWidth
    />
  );
  const input = screen.getByLabelText('Amount');
  expect(input).toBeDisabled();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Invalid amount');
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid amount');
  expect(input.closest('.outlined-field')).toHaveAttribute(
    'data-size',
    'small'
  );
});

it('defaults outlined controls to full width with single-line labels and values', (): void => {
  render(
    <>
      <TextInput label="Name" />
      <NumberInput label="Amount" />
      <Select label="Closing day">
        <option>Very long selection</option>
      </Select>
    </>
  );
  for (const control of [
    screen.getByLabelText('Name'),
    screen.getByLabelText('Amount'),
    screen.getByRole('combobox'),
  ]) {
    expect(control.closest('.outlined-field')).toHaveClass('w-full');
    expect(control).toHaveClass('truncate', 'whitespace-nowrap');
    expect(
      control.closest('.outlined-box')?.querySelector('label')
    ).toHaveClass('truncate', 'whitespace-nowrap');
    expect(
      control.closest('.outlined-box')?.querySelector('legend')
    ).toHaveClass('truncate', 'whitespace-nowrap');
  }
});

it('keeps small-size padding within the field height', (): void => {
  const styles = readFileSync(`${process.cwd()}/src/app/globals.css`, 'utf8');
  expect(styles).toMatch(
    /\.outlined-field\[data-size='small'\] select\s*\{\s*padding-top: 6px;\s*padding-bottom: 6px;/
  );
});

it('defaults date fields to full container width', (): void => {
  render(<DateField label="Date" value={null} onChange={jest.fn()} />);
  expect(screen.getByLabelText('Date').closest('.outlined-field')).toHaveClass(
    'w-full'
  );
  expect(
    screen.getByLabelText('Date').closest('.outlined-field')?.parentElement
  ).toHaveClass('w-full');
});
it('uses the danger tone above ninety percent and caps visual usage', (): void => {
  const { rerender } = render(<ProgressBar label="Usage" value={95} danger />);
  expect(screen.getByRole('progressbar').firstElementChild).toHaveClass(
    'bg-[var(--ctp-red)]'
  );
  rerender(<ProgressBar label="Usage" value={120} danger />);
  expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({
    width: '100%',
  });
  rerender(<ProgressBar label="Usage" value={90} />);
  expect(screen.getByRole('progressbar').firstElementChild).toHaveClass(
    'bg-[var(--ctp-blue)]'
  );
});
