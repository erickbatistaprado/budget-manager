import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type JSX } from 'react';
import I18nProvider from '@/i18n/I18nProvider';
import type { Language } from '@/i18n/language';
import { DateField, MonthSwitcher } from './index';

function DateExample(): JSX.Element {
  const [value, setValue] = useState<Date | null>(null);
  return (
    <>
      <DateField label="Date" value={value} onChange={setValue} />
      <output>{value?.getDate()}</output>
    </>
  );
}
it.each(['en', 'pt'] as Language[])(
  'accepts masked dates and rejects impossible dates in %s',
  (language): void => {
    render(
      <I18nProvider initialLanguage={language}>
        <DateExample />
      </I18nProvider>
    );
    const input = screen.getByLabelText('Date');
    fireEvent.change(input, {
      target: { value: language === 'pt' ? '25112026' : '11252026' },
    });
    expect(input).toHaveValue(language === 'pt' ? '25/11/2026' : '11/25/2026');
    expect(screen.getByRole('status')).toHaveTextContent('25');
    fireEvent.change(input, {
      target: { value: language === 'pt' ? '31022026' : '02312026' },
    });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(
      language === 'pt' ? 'data válida' : 'valid date'
    );
    fireEvent.change(input, { target: { value: '12' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
  }
);
it.each(['en', 'pt'] as Language[])(
  'opens the calendar, closes with Escape, and shows short weekdays without shortcuts in %s',
  (language): void => {
    render(
      <I18nProvider initialLanguage={language}>
        <DateExample />
      </I18nProvider>
    );
    const input = screen.getByLabelText('Date');
    fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
    const calendar = screen.getByRole('dialog');
    expect(calendar).toBeInTheDocument();
    const weekdays = screen.getAllByRole('columnheader');
    expect(weekdays).toHaveLength(7);
    const shortNames =
      language === 'pt'
        ? ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
        : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    weekdays.forEach((weekday, index): void => {
      expect(within(weekday).getByText(shortNames[index])).toHaveAttribute(
        'aria-hidden',
        'true'
      );
    });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: /^(Today|Yesterday|Hoje|Ontem)$/ })
    ).not.toBeInTheDocument();
  }
);
it.each(['en', 'pt'] as Language[])(
  'switches months with arrows and the month grid in %s',
  (language): void => {
    const onChange = jest.fn();
    render(
      <I18nProvider initialLanguage={language}>
        <MonthSwitcher value={new Date(2026, 10, 1)} onChange={onChange} />
      </I18nProvider>
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Mês anterior' : 'Previous month',
      })
    );
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 9, 1));
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'pt' ? 'Próximo mês' : 'Next month',
      })
    );
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 11, 1));
    fireEvent.click(screen.getByRole('button', { name: /2026/ }));
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '2027' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: language === 'pt' ? 'jan.' : 'Jan' })
    );
    expect(onChange).toHaveBeenLastCalledWith(new Date(2027, 0, 1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }
);

it('enforces the permitted range and invalidates an incomplete field', (): void => {
  render(
    <DateField
      label="Date"
      value={null}
      onChange={jest.fn()}
      min={new Date(2026, 0, 10)}
      max={new Date(2026, 0, 20)}
    />
  );
  const input = screen.getByLabelText('Date');
  fireEvent.change(input, { target: { value: '01/09/2026' } });
  expect(input).toBeInvalid();
  fireEvent.change(input, { target: { value: '01/10/2026' } });
  expect(input).toBeValid();
  fireEvent.change(input, { target: { value: '01/21/2026' } });
  expect(input).toBeInvalid();
});
it('uses the system date input on coarse pointers', (): void => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (): object => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  const onChange = jest.fn();
  try {
    render(
      <DateField
        label="Date"
        value={new Date(2026, 0, 10)}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('Date');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-01-10');
    fireEvent.change(input, { target: { value: '2026-01-20' } });
    expect(onChange).toHaveBeenCalledWith(new Date(2026, 0, 20));
  } finally {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
  }
});

it('closes the calendar on a press outside or Escape from anywhere, without closing the drawer around it', (): void => {
  const onDrawerKey = jest.fn();
  render(
    <I18nProvider initialLanguage="en">
      <div onKeyDown={onDrawerKey}>
        <DateExample />
        <button type="button">Outside</button>
      </div>
    </I18nProvider>
  );
  const input = screen.getByLabelText('Date');
  fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
  fireEvent.pointerDown(screen.getByRole('dialog'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(onDrawerKey).not.toHaveBeenCalledWith(
    expect.objectContaining({ key: 'Escape' })
  );
});

it('closes the month picker on a press outside', (): void => {
  render(
    <I18nProvider initialLanguage="en">
      <MonthSwitcher value={new Date(2026, 10, 1)} onChange={jest.fn()} />
      <button type="button">Outside</button>
    </I18nProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'November 2026' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
