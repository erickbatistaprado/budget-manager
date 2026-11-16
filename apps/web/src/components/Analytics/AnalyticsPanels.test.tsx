import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import { RankedList } from './AnalyticsPanels';

const items = [
  { label: 'Groceries', amount: 600, share: 60 },
  { label: 'Restaurants', amount: 400, share: 40 },
];

it('scrolls a long ranked list inside a named, focusable region', (): void => {
  renderWithI18n(
    <RankedList items={items} scrollLabel="Where your money goes" />
  );
  const region = screen.getByRole('region', { name: 'Where your money goes' });
  expect(region).toHaveClass('max-h-80', 'overflow-y-auto');
  expect(region).toHaveAttribute('tabindex', '0');
  expect(region).toContainElement(screen.getByText('Groceries'));
});

it('renders the plain list without a scroll region by default', (): void => {
  renderWithI18n(<RankedList items={items} />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});
