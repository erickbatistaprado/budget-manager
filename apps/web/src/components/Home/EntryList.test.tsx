import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type JSX } from 'react';
import I18nProvider from '@/i18n/I18nProvider';
import type { Language } from '@/i18n/language';
import EntryList from './EntryList';
import type { Entry } from './model';
import { formatBRL } from '@/utils/analytics.util';
jest.mock('@/hooks', (): object => ({
  useCurrentUser: (): object => ({ data: { id: 'viewer' } }),
}));
jest.mock('@/components', (): object => ({
  FinancialMovements: (): null => null,
}));
const entries: Entry[] = [
  {
    key: 'first',
    type: 'income',
    amount: 10,
    date: new Date(2026, 0, 10).getTime(),
    category: 'Alpha',
    payment: ['Cash'],
    search: 'Alpha',
    description: 'Alpha',
    unassigned: false,
  },
  {
    key: 'second',
    type: 'movements',
    amount: 20,
    date: new Date(2026, 0, 20).getTime(),
    category: 'Beta',
    payment: ['Debit'],
    search: 'Beta',
    description: 'Beta',
    unassigned: false,
  },
];
function Example({
  language,
  month = 0,
}: {
  language: Language;
  month?: number;
}): JSX.Element {
  const [unassigned, setUnassigned] = useState(false);
  return (
    <I18nProvider initialLanguage={language}>
      <EntryList
        entries={entries}
        month={new Date(2026, month, 1)}
        names={{}}
        unassigned={unassigned}
        onUnassigned={setUnassigned}
        onRecord={jest.fn()}
        loading={false}
      />
    </I18nProvider>
  );
}
beforeEach((): void => localStorage.clear());
it.each(['en', 'pt'] as Language[])(
  'filters, updates totals, clears and persists controls in %s',
  (language): void => {
    const { unmount } = render(<Example language={language} />);
    const portuguese = language === 'pt';
    const minimum = portuguese ? 'Valor mínimo' : 'Minimum value';
    const maximum = portuguese ? 'Valor máximo' : 'Maximum value';
    fireEvent.click(
      screen.getByRole('button', { name: portuguese ? 'Filtros' : 'Filters' })
    );
    fireEvent.change(screen.getByLabelText(minimum), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText(maximum), {
      target: { value: '20' },
    });
    expect(
      within(screen.getByRole('table')).getAllByRole('row').slice(1)
    ).toHaveLength(1);
    expect(screen.getByText(/\(1\)/)).toHaveTextContent(
      formatBRL(20, language).replace(/\s/g, ' ')
    );
    fireEvent.click(
      within(screen.getByRole('table')).getByRole('button', {
        name: portuguese ? 'Ordenar por Valor' : 'Sort by Value',
      })
    );
    fireEvent.change(screen.getByLabelText(portuguese ? 'De' : 'From'), {
      target: { value: portuguese ? '11/01/2026' : '01/11/2026' },
    });
    unmount();
    render(<Example language={language} />);
    fireEvent.click(
      screen.getByRole('button', { name: portuguese ? 'Filtros' : 'Filters' })
    );
    expect(screen.getByLabelText(minimum)).toHaveValue(20);
    expect(screen.getByLabelText(portuguese ? 'De' : 'From')).toHaveValue(
      portuguese ? '11/01/2026' : '01/11/2026'
    );
    expect(screen.getAllByRole('columnheader')[3]).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: portuguese ? 'Limpar filtros' : 'Clear filters',
      })
    );
    expect(screen.getByLabelText(minimum)).toHaveValue(null);
    expect(
      within(screen.getByRole('table')).getAllByRole('row').slice(1)
    ).toHaveLength(2);
    expect(screen.getAllByRole('columnheader')[3]).toHaveAttribute(
      'aria-sort',
      'descending'
    );
  }
);
it('resets the day range when changing months and tolerates unavailable storage', (): void => {
  const { rerender } = render(<Example language="en" />);
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('From'), {
    target: { value: '01/11/2026' },
  });
  expect(
    within(screen.getByRole('table')).getAllByRole('row').slice(1)
  ).toHaveLength(1);
  rerender(<Example language="en" month={1} />);
  expect(screen.getByLabelText('From')).toHaveValue('');
  const storage = jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation((): never => {
      throw new Error('Unavailable');
    });
  fireEvent.change(screen.getByLabelText('Minimum value'), {
    target: { value: '20' },
  });
  expect(
    within(screen.getByRole('table')).getAllByRole('row').slice(1)
  ).toHaveLength(1);
  storage.mockRestore();
});

it.each(['en', 'pt'] as Language[])(
  'sorts all headers and toggles the filter popover in %s',
  (language): void => {
    render(<Example language={language} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[2]).toHaveAttribute('aria-sort', 'descending');
    for (const [index, direction] of [
      [0, 'ascending'],
      [1, 'ascending'],
      [3, 'descending'],
      [2, 'descending'],
    ] as const) {
      fireEvent.click(within(headers[index]).getByRole('button'));
      expect(headers[index]).toHaveAttribute('aria-sort', direction);
      expect(screen.getAllByRole('row')[1]).toHaveTextContent(
        direction === 'ascending' ? 'Alpha' : 'Beta'
      );
      fireEvent.click(within(headers[index]).getByRole('button'));
      expect(headers[index]).toHaveAttribute(
        'aria-sort',
        direction === 'ascending' ? 'descending' : 'ascending'
      );
      expect(screen.getAllByRole('row')[1]).toHaveTextContent(
        direction === 'ascending' ? 'Beta' : 'Alpha'
      );
      expect(
        headers.filter(
          (header): boolean =>
            header.getAttribute('aria-sort') !== 'none' &&
            header.hasAttribute('aria-sort')
        )
      ).toHaveLength(1);
    }
    const trigger = screen.getByRole('button', {
      name: language === 'pt' ? 'Filtros' : 'Filters',
    });
    fireEvent.click(trigger);
    expect(
      within(screen.getByRole('dialog')).getAllByRole('button')[0]
    ).toHaveFocus();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(within(trigger).getByText('1')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: / ×$/ }));
    expect(within(trigger).queryByText('1')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }
);

it.each(['en', 'pt'] as Language[])(
  'removes individual filters and clears all in %s',
  (language): void => {
    render(<Example language={language} />);
    const portuguese = language === 'pt';
    const trigger = screen.getByRole('button', {
      name: portuguese ? 'Filtros' : 'Filters',
    });
    fireEvent.click(trigger);
    const selects = within(screen.getByRole('dialog')).getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Beta' } });
    fireEvent.change(selects[1], { target: { value: 'Debit' } });
    fireEvent.change(
      screen.getByLabelText(portuguese ? 'Valor mínimo' : 'Minimum value'),
      { target: { value: '10' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: portuguese ? 'Concluir' : 'Done' })
    );
    expect(within(trigger).getByText('3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: / ≥ .* ×$/ })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /: Beta ×$/ }));
    expect(within(trigger).getByText('2')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: portuguese ? 'Limpar tudo' : 'Clear all',
      })
    );
    expect(
      screen.queryByRole('button', { name: / ×$/ })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    fireEvent.click(trigger);
    expect(selects[0]).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getAllByRole('combobox')[1]
    ).toHaveValue('');
  }
);

it('offers the same sort buttons above the table for phones', (): void => {
  render(<Example language="en" />);
  const phoneSort = screen.getByRole('group', { name: 'Sort by' });
  fireEvent.click(
    within(phoneSort).getByRole('button', { name: 'Sort by Value' })
  );
  expect(screen.getAllByRole('columnheader')[3]).toHaveAttribute(
    'aria-sort',
    'descending'
  );
});
