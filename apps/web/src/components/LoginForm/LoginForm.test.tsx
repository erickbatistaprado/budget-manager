import { authenticationService } from '@/services';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginForm from './LoginForm.component';

jest.mock('@/services', () => ({
  authenticationService: { login: jest.fn().mockResolvedValue(undefined) },
  userService: { createUser: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

it('signs in through the form, so Enter in a field submits it', async (): Promise<void> => {
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'test@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret' },
  });
  expect(screen.getByRole('button', { name: 'Login' })).toHaveAttribute(
    'type',
    'submit'
  );
  fireEvent.submit(screen.getByRole('form', { name: 'Sign In' }));
  await waitFor((): void => expect(mockPush).toHaveBeenCalledWith('/'));
  expect(authenticationService.login).toHaveBeenCalledWith({
    email: 'test@example.com',
    password: 'secret',
  });
});
