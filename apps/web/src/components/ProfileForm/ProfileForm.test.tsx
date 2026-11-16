import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '@/i18n/testing';
import {
  deleteFetcher,
  getBlobFetcher,
  postFetcher,
  putFetcher,
} from '@/libs/fetchers.lib';
import ProfileForm from './ProfileForm.component';
import LanguageSwitcher from '@/components/LanguageSwitcher/LanguageSwitcher.component';

const mockMutate = jest.fn().mockResolvedValue(undefined);
const mockSummary = {
  firstEntryDate: '2026-01-01',
  entryCount: 12,
  maxProfileImageBytes: 2097152,
};
let mockPhoto: Blob | undefined;
const mockUser = {
  id: 'owner',
  name: 'Erick',
  email: 'owner@example.com',
  roles: [],
  salaryDay: null,
};
jest.mock('@/hooks/useAccounts.hook', (): object => ({
  __esModule: true,
  default: (): object => ({
    data: [
      { id: 'checking', name: 'Checking' },
      { id: 'savings', name: 'Savings' },
    ],
  }),
}));
jest.mock('@/hooks', (): object => ({
  useCurrentUser: (): object => ({ data: mockUser, mutate: mockMutate }),
  useProfileImage: (): object => ({ data: mockPhoto, mutate: mockMutate }),
}));
jest.mock('swr', (): object => ({
  __esModule: true,
  default: (): object => ({ data: mockSummary }),
}));
jest.mock('@/libs/fetchers.lib', (): object => ({
  putFetcher: jest.fn(),
  postFetcher: jest.fn(),
  deleteFetcher: jest.fn(),
  getFetcher: jest.fn(),
  getBlobFetcher: jest.fn(),
}));

beforeEach((): void => {
  jest.clearAllMocks();
  mockPhoto = undefined;
  localStorage.clear();
  jest.mocked(putFetcher).mockResolvedValue(undefined);
  jest.mocked(postFetcher).mockResolvedValue(undefined);
  jest.mocked(deleteFetcher).mockResolvedValue(undefined);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn().mockReturnValue('blob:photo'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
});

it('prefills profile, disables unchanged and blank name, saves only the name and stays on the page', async (): Promise<void> => {
  renderWithI18n(<ProfileForm />);
  const section = screen.getByRole('region', { name: 'Profile' });
  const name = within(section).getByRole('textbox', { name: 'Name' });
  const save = within(section).getByRole('button', { name: 'Save' });
  expect(name).toHaveValue('Erick');
  expect(
    within(section).getByRole('textbox', { name: 'Email' })
  ).toHaveAttribute('readonly');
  expect(save).toBeDisabled();
  fireEvent.change(name, { target: { value: ' ' } });
  expect(save).toBeDisabled();
  fireEvent.change(name, { target: { value: 'New name' } });
  fireEvent.click(save);
  expect(save).toBeDisabled();
  await waitFor((): void =>
    expect(within(section).getByText('Saved')).toBeInTheDocument()
  );
  expect(putFetcher).toHaveBeenCalledWith('/users', {
    body: JSON.stringify({ name: 'New name' }),
  });
  expect(screen.getByRole('region', { name: 'Security' })).toBeInTheDocument();
});

it('reports a name save error in the section live region', async (): Promise<void> => {
  jest.mocked(putFetcher).mockRejectedValue(new Error('network'));
  renderWithI18n(<ProfileForm />);
  const section = screen.getByRole('region', { name: 'Profile' });
  fireEvent.change(within(section).getByRole('textbox', { name: 'Name' }), {
    target: { value: 'New' },
  });
  fireEvent.click(within(section).getByRole('button', { name: 'Save' }));
  await waitFor((): void =>
    expect(
      within(section).getByText('Unable to save your name. Try again.')
    ).toHaveAttribute('role', 'status')
  );
});

it('checks each password rule live and requires current password and matching confirmation', async (): Promise<void> => {
  renderWithI18n(<ProfileForm />);
  const security = screen.getByRole('region', { name: 'Security' });
  const save = within(security).getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'weak' },
  });
  expect(screen.getByText('✓ A lowercase letter')).toBeInTheDocument();
  expect(screen.getByText('○ An uppercase letter')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'N3w!Password' },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'different' },
  });
  expect(screen.getByText('Passwords must match.')).toBeInTheDocument();
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'N3w!Password' },
  });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'Current!1' },
  });
  fireEvent.click(save);
  await waitFor((): void =>
    expect(within(security).getByText('Saved')).toBeInTheDocument()
  );
  expect(putFetcher).toHaveBeenCalledWith('/users', {
    body: JSON.stringify({
      currentPassword: 'Current!1',
      password: 'N3w!Password',
    }),
  });
  expect(screen.getByLabelText('Current password')).toHaveValue('');
});

it('announces an incorrect current password without clearing the form', async (): Promise<void> => {
  jest
    .mocked(putFetcher)
    .mockRejectedValue(
      new Error('HTTP 400: Current password is missing or incorrect')
    );
  renderWithI18n(<ProfileForm />);
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'N3w!Password' },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'N3w!Password' },
  });
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'wrong' },
  });
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Security' })).getByRole(
      'button',
      { name: 'Save' }
    )
  );
  expect(
    await screen.findByText('Current password is missing or incorrect.')
  ).toBeInTheDocument();
  expect(screen.getByLabelText('New password')).toHaveValue('N3w!Password');
});

it('validates salary day and saves main account preferences', async (): Promise<void> => {
  renderWithI18n(<ProfileForm />);
  const section = screen.getByRole('region', { name: 'Preferences' });
  const save = within(section).getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Salary day'), {
    target: { value: '32' },
  });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Salary day'), {
    target: { value: '15' },
  });
  fireEvent.change(screen.getByLabelText('Main account'), {
    target: { value: 'checking' },
  });
  fireEvent.click(save);
  await waitFor((): void =>
    expect(within(section).getByText('Saved')).toBeInTheDocument()
  );
  expect(putFetcher).toHaveBeenCalledWith('/users/current/preferences', {
    body: JSON.stringify({ salaryDay: 15, mainAccountId: 'checking' }),
  });
});

it('keeps language and theme selects synchronized with the header controls, in both languages', (): void => {
  renderWithI18n(
    <>
      <ProfileForm />
      <LanguageSwitcher />
    </>,
    { language: 'pt' }
  );
  expect(
    screen.getByRole('region', { name: 'Seus dados' })
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Idioma', { selector: 'select' }), {
    target: { value: 'en' },
  });
  expect(screen.getByRole('radio', { name: 'EN' })).toBeChecked();
  expect(screen.getByRole('region', { name: 'Your data' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'PT' }));
  expect(screen.getByLabelText('Idioma', { selector: 'select' })).toHaveValue(
    'pt'
  );
  fireEvent.change(screen.getByLabelText('Tema', { selector: 'select' }), {
    target: { value: 'latte' },
  });
  expect(document.documentElement.dataset.theme).toBe('latte');
  fireEvent.change(screen.getByLabelText('Tema', { selector: 'select' }), {
    target: { value: 'macchiato' },
  });
  expect(screen.getByLabelText('Tema', { selector: 'select' })).toHaveValue(
    'macchiato'
  );
  fireEvent.change(screen.getByLabelText('Tema', { selector: 'select' }), {
    target: { value: 'system' },
  });
  expect(localStorage.getItem('budget-manager-theme')).toBe('system');
  expect(screen.getByText('Salvo')).toBeInTheDocument();
});

it('rejects oversized and unsupported images before uploading and saves a valid photo', async (): Promise<void> => {
  renderWithI18n(<ProfileForm />);
  const input = screen.getByLabelText('Change photo', { selector: 'input' });
  fireEvent.change(input, {
    target: {
      files: [
        new File([new Uint8Array(2097153)], 'large.png', { type: 'image/png' }),
      ],
    },
  });
  expect(
    screen.getByText('The image exceeds the upload limit.')
  ).toBeInTheDocument();
  expect(postFetcher).not.toHaveBeenCalled();
  fireEvent.change(input, {
    target: { files: [new File(['gif'], 'photo.gif', { type: 'image/gif' })] },
  });
  expect(screen.getByText('Choose a PNG or JPEG image.')).toBeInTheDocument();
  fireEvent.change(input, {
    target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })] },
  });
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(postFetcher).toHaveBeenCalledWith('/user-image', {
    body: expect.any(FormData),
  });
});

it('removes a photo with its own message', async (): Promise<void> => {
  mockPhoto = new Blob(['photo']);
  renderWithI18n(<ProfileForm />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(deleteFetcher).toHaveBeenCalledWith('/user-image');
});

it('downloads the backup and displays data statistics', async (): Promise<void> => {
  const blob = new Blob(['{}']);
  Object.defineProperty(blob, 'text', {
    value: async (): Promise<string> =>
      JSON.stringify({ exportedAt: '2026-11-15T12:00:00Z' }),
  });
  jest.mocked(getBlobFetcher).mockResolvedValue(blob);
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation((): void => {});
  renderWithI18n(<ProfileForm />);
  expect(screen.getByText('12 entries')).toBeInTheDocument();
  expect(screen.getByText(/First entry on/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Download backup (JSON)' })
  );
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(getBlobFetcher).toHaveBeenCalledWith('/users/current/export');
  expect(click).toHaveBeenCalledTimes(1);
  click.mockRestore();
});

it('rejects passwords exceeding BCrypt’s byte limit even when every character rule passes', (): void => {
  renderWithI18n(<ProfileForm />);
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'Current!1' },
  });
  const longPassword = 'N3w!' + 'é'.repeat(35);
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: longPassword },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: longPassword },
  });
  expect(
    screen.getByText('○ At most 72 characters (fewer with accents or emoji)')
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Security' })).getByRole(
      'button',
      { name: 'Save' }
    )
  ).toBeDisabled();
});

it('announces preference and backup failures in their own sections in Portuguese', async (): Promise<void> => {
  jest.mocked(putFetcher).mockRejectedValue(new Error('network'));
  jest.mocked(getBlobFetcher).mockRejectedValue(new Error('network'));
  renderWithI18n(<ProfileForm />, { language: 'pt' });
  fireEvent.change(screen.getByLabelText('Dia do salário'), {
    target: { value: '10' },
  });
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Preferências' })).getByRole(
      'button',
      { name: 'Salvar' }
    )
  );
  expect(
    await screen.findByText(
      'Não foi possível salvar o dia do salário. Tente novamente.'
    )
  ).toHaveAttribute('role', 'status');
  fireEvent.click(screen.getByRole('button', { name: 'Baixar backup (JSON)' }));
  expect(
    await screen.findByText(
      'Não foi possível baixar o backup. Tente novamente.'
    )
  ).toHaveAttribute('role', 'status');
});
