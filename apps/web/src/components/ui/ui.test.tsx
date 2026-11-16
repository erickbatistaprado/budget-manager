import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  IconButton,
  NumberInput,
  Panel,
  Select,
  TextInput,
} from './index';

describe('shared controls', (): void => {
  it.each([
    ['primary', 'bg-[var(--ctp-blue)]'],
    ['secondary', 'bg-[var(--ctp-surface1)]'],
    ['danger', 'bg-[var(--ctp-red)]/15'],
    ['ghost', 'text-[var(--ctp-blue)]'],
  ] as const)(
    'renders the %s button variant',
    (variant, expectedClass): void => {
      render(<Button variant={variant}>Action</Button>);
      expect(screen.getByRole('button')).toHaveClass(expectedClass);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    }
  );
  it.each([
    ['sm', 'min-h-8'],
    ['md', 'min-h-10'],
    ['lg', 'min-h-12'],
  ] as const)('renders the %s button size', (size, expectedClass): void => {
    render(<Button size={size}>Action</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });
  it('forwards button refs and native props and respects disabled', (): void => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = jest.fn();
    render(
      <Button
        ref={ref}
        type="submit"
        name="save"
        form="entry"
        disabled
        fullWidth
        onClick={onClick}
      >
        Save
      </Button>
    );
    const button = screen.getByRole('button');
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('name', 'save');
    expect(button).toHaveAttribute('form', 'entry');
    expect(button).toHaveClass(
      'w-full',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed'
    );
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('gives icon buttons an accessible name and forwards their ref', (): void => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton ref={ref} aria-label="Delete">
        ×
      </IconButton>
    );
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Delete' }));
  });
  it('wires labels, hint and error while preserving existing descriptions', (): void => {
    const ref = createRef<HTMLInputElement>();
    render(
      <>
        <p id="existing">Existing description</p>
        <Field label="Amount" hint="In reais" error="Required">
          <TextInput
            ref={ref}
            id="amount"
            aria-describedby="existing"
            required
            name="amount"
          />
        </Field>
      </>
    );
    const input = screen.getByRole('textbox', { name: 'Amount' });
    expect(screen.getByLabelText('Amount')).toBe(input);
    expect(input).toHaveAttribute('id', 'amount');
    expect(input).toHaveAttribute(
      'aria-describedby',
      'existing amount-hint amount-error'
    );
    expect(input).toHaveAccessibleDescription(
      'Existing description In reais Required'
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('name', 'amount');
    expect(ref.current).toBe(input);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('generates unique field ids and omits empty descriptions', (): void => {
    render(
      <>
        <Field label="First">
          <TextInput />
        </Field>
        <Field label="Second">
          <TextInput />
        </Field>
      </>
    );
    const first = screen.getByLabelText('First');
    const second = screen.getByLabelText('Second');
    expect(first.id).not.toBe(second.id);
    expect(first).not.toHaveAttribute('aria-describedby');
    expect(first).not.toHaveAttribute('aria-invalid');
  });

  it('forwards input, number, select and checkbox native props and refs', (): void => {
    const textRef = createRef<HTMLInputElement>();
    const numberRef = createRef<HTMLInputElement>();
    const selectRef = createRef<HTMLSelectElement>();
    const checkboxRef = createRef<HTMLInputElement>();
    render(
      <>
        <TextInput ref={textRef} aria-label="Text" disabled />
        <NumberInput ref={numberRef} aria-label="Number" min={1} step="0.01" />
        <Select
          ref={selectRef}
          aria-label="Select"
          disabled
          options={[{ value: 'one', label: 'One' }]}
        />
        <Checkbox ref={checkboxRef} label="Enabled" disabled defaultChecked />
      </>
    );
    expect(textRef.current).toBe(screen.getByRole('textbox', { name: 'Text' }));
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(numberRef.current).toBe(screen.getByRole('spinbutton'));
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.01');
    expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '1');
    expect(selectRef.current).toBe(screen.getByRole('combobox'));
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('option', { name: 'One' })).toHaveValue('one');
    expect(checkboxRef.current).toBe(
      screen.getByRole('checkbox', { name: 'Enabled' })
    );
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('accepts select children and native panel form props and ref', (): void => {
    const ref = createRef<HTMLFormElement>();
    const onSubmit = jest.fn((event: React.FormEvent<HTMLFormElement>): void =>
      event.preventDefault()
    );
    render(
      <Panel
        as="form"
        ref={ref}
        aria-label="Entry"
        title="New entry"
        onSubmit={onSubmit}
      >
        <Select aria-label="Account">
          <option value="cash">Cash</option>
        </Select>
        <Badge>Automatic</Badge>
        <Button type="submit">Save</Button>
      </Panel>
    );
    expect(ref.current).toBe(screen.getByRole('form'));
    expect(
      screen.getByRole('heading', { name: 'New entry' })
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cash' })).toHaveValue('cash');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
