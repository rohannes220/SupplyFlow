import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ProtectedRoute from './ProtectedRoute.jsx';
import { TOKEN_STORAGE_KEY } from '../context/AuthContext.jsx';
import { adminUser, fakeAuthApi, renderWithAuth } from '../test/authTestUtils.jsx';

const page = (
  <ProtectedRoute>
    <p>Secret dashboard</p>
  </ProtectedRoute>
);

beforeEach(() => localStorage.clear());

describe('ProtectedRoute', () => {
  it('redirects to /login when not logged in', async () => {
    renderWithAuth(page);
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('renders its children when logged in', async () => {
    renderWithAuth(page, { user: adminUser });
    expect(await screen.findByText('Secret dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });

  it('waits for the stored session to be checked instead of redirecting early', () => {
    const api = fakeAuthApi(adminUser);
    api.getMe.mockReturnValue(new Promise(() => {})); // never settles
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    renderWithAuth(page, { api });

    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('redirects to /login when the stored token is rejected', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    renderWithAuth(page, { api: fakeAuthApi(null) });
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });
});
