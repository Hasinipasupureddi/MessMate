import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'messmate_local_user';

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="loading">{auth.loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{auth.user?.name || 'none'}</div>
      <button
        type="button"
        onClick={() => auth.signIn('arjun.mehta@messmate.in', 'Student@2026', { rememberMe: true })}
      >
        Sign in
      </button>
      <button type="button" onClick={() => auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}

describe('Auth flow smoke coverage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('hydrates a stored session and clears it on sign out', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'demo-staff-1',
            email: 'raju.cook@messmate.in',
            name: 'Raju Cook',
            role: 'staff',
            hostelId: 'A',
            emailVerified: true,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signedOut: true }),
      } as Response);
    global.fetch = fetchMock as never;

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    expect(screen.getByTestId('user')).toHaveTextContent('Raju Cook');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('signs in and persists the returned user', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: 'demo-student-1',
          email: 'arjun.mehta@messmate.in',
          name: 'Arjun Mehta',
          role: 'student',
          hostelId: 'A',
          emailVerified: true,
        },
        session: { local: true, rememberMe: true },
      }),
    } as Response);
    global.fetch = fetchMock as never;

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Arjun Mehta'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/signin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'arjun.mehta@messmate.in',
          password: 'Student@2026',
          rememberMe: true,
        }),
      })
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('arjun.mehta@messmate.in');
  });
});