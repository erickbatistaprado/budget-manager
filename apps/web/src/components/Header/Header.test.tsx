import { screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { renderWithI18n } from '@/i18n/testing';
import Header from './Header.component';

jest.mock('@/components', (): object => ({
  NewTransaction: (): JSX.Element => <div data-testid="new-entry" />,
  SideMenu: (): JSX.Element => <nav data-testid="side-menu" />,
  Tooltip: ({ children }: { children: ReactNode }): ReactNode => children,
}));
jest.mock('@/hooks', (): object => ({
  useProfileImage: (): object => ({ data: undefined }),
}));

it('keeps the drawers outside the sliding bar and inert while closed', (): void => {
  renderWithI18n(<Header />);
  const bar = screen.getByTestId('header-bar');
  const newEntry = screen.getByTestId('new-entry');
  const sideMenu = screen.getByTestId('side-menu');
  expect(bar).not.toContainElement(newEntry);
  expect(bar).not.toContainElement(sideMenu);
  expect(bar).not.toContainElement(screen.getByTestId('new-entry-drawer'));
  expect(screen.getByTestId('new-entry-drawer')).toHaveAttribute('inert');
  expect(screen.getByTestId('side-menu-drawer')).toHaveAttribute('inert');
});
