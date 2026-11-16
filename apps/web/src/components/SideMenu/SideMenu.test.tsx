import { authenticationService } from '@/services';
import { fireEvent, render, screen } from '@testing-library/react';
import SideMenu from './SideMenu.component';

jest.mock('@/services', () => ({
  authenticationService: { logout: jest.fn() },
}));

const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

describe('SideMenu', (): void => {
  const mockOnClose = jest.fn();

  beforeEach((): void => {
    mockPathname = '/';
    jest.clearAllMocks();
  });

  it('renders all menu buttons', (): void => {
    render(<SideMenu onClose={mockOnClose} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('calls onClose and pushes when a navigation button is clicked', (): void => {
    render(<SideMenu onClose={mockOnClose} />);

    const homeButton: HTMLElement = screen.getByText('Home');
    fireEvent.click(homeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('calls authenticationService.logout when Sign Out button is clicked', (): void => {
    render(<SideMenu onClose={mockOnClose} />);

    const signOutButton: HTMLElement = screen.getByText('Sign Out');

    fireEvent.click(signOutButton);
    expect(authenticationService.logout).toHaveBeenCalledTimes(1);
  });

  it('marks the current route as active', (): void => {
    mockPathname = '/savings';

    render(<SideMenu onClose={mockOnClose} />);

    expect(screen.getByRole('button', { name: /savings/i })).toHaveClass(
      'bg-[var(--ctp-blue)]/20'
    );
  });

  it('calls onClose and pushes correctly for other buttons', (): void => {
    render(<SideMenu onClose={mockOnClose} />);

    const analyticsButton: HTMLElement = screen.getByText('Analytics');
    fireEvent.click(analyticsButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/analytics');

    const profileButton: HTMLElement = screen.getByText('Profile');
    fireEvent.click(profileButton);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/profile');
  });

  it('renders the language switcher with EN and PT options', (): void => {
    render(<SideMenu onClose={mockOnClose} />);

    expect(screen.getByRole('radio', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'PT' })).toBeInTheDocument();
  });
});

it('uses left aligned navigation, distinct icons, and only the language menu preference', (): void => {
  render(<SideMenu onClose={jest.fn()} />);
  const labels = [
    'Home',
    'Analytics',
    'Savings',
    'Financing',
    'Cards and accounts',
    'Import',
    'Profile',
    'Sign Out',
  ];
  const paths = labels.map((label): string | null => {
    const button = screen.getByRole('button', { name: label });
    expect(button).toHaveClass(
      '!justify-start',
      '!gap-3',
      'text-[var(--ctp-text)]'
    );
    // Compare the paths drawn by react-icons for each navigation item.
    // eslint-disable-next-line testing-library/no-node-access
    return button.querySelector('svg')?.innerHTML ?? null;
  });
  expect(new Set(paths).size).toBe(labels.length);
  expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(screen.getByRole('button', { name: 'Analytics' })).not.toHaveAttribute(
    'aria-current'
  );
  expect(
    screen.queryByRole('radio', { name: 'Light' })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Dark' })).not.toBeInTheDocument();
});
