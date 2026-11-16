import { fireEvent, screen, within } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { renderWithI18n } from '@/i18n/testing';
import Header from './Header.component';

jest.mock('@/components', (): object => ({
  NewTransaction: (): JSX.Element => <div data-testid="new-entry" />,
  SideMenu: ({ onNewEntry }: { onNewEntry?: () => void }): JSX.Element => (
    <nav data-testid="side-menu">
      {onNewEntry && (
        <button type="button" onClick={onNewEntry}>
          Open new entry
        </button>
      )}
    </nav>
  ),
  Tooltip: ({ children }: { children: ReactNode }): ReactNode => children,
}));
jest.mock('@/hooks', (): object => ({
  useProfileImage: (): object => ({ data: undefined }),
}));

it('keeps the phone menu drawer outside the sliding bar and inert while closed', (): void => {
  renderWithI18n(<Header />);
  const bar = screen.getByTestId('header-bar');
  const [sideMenu] = within(
    screen.getByTestId('side-menu-drawer')
  ).getAllByTestId('side-menu');
  expect(bar).not.toContainElement(sideMenu);
  expect(screen.getByTestId('side-menu-drawer')).toHaveAttribute('inert');
  expect(screen.queryByTestId('new-entry-drawer')).not.toBeInTheDocument();
});

it('puts the side menu in a desktop rail and keeps the top bar for phones only', (): void => {
  renderWithI18n(<Header />);
  expect(screen.getByTestId('side-rail')).toHaveClass('hidden', 'md:block');
  expect(screen.getByTestId('header-bar')).toHaveClass('md:hidden');
  expect(screen.getByTestId('side-menu-drawer')).toHaveClass('md:hidden');
});

it('opens new transaction in the shared side panel from the left and closes it', (): void => {
  renderWithI18n(<Header />);
  fireEvent.click(screen.getByRole('button', { name: 'Open new entry' }));
  const panel = screen.getByTestId('new-entry-drawer');
  expect(panel).toHaveClass('left-0', 'right-auto');
  expect(screen.getByTestId('header-bar')).not.toContainElement(panel);
  expect(within(panel).getByTestId('new-entry')).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
  expect(screen.queryByTestId('new-entry-drawer')).not.toBeInTheDocument();
});
