import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsersPage from './UsersPage.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

afterEach(() => vi.restoreAllMocks());

describe('UsersPage', () => {
  it('loads the current list using the bearer token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'employee' }],
    });
    render(<UsersPage />);
    expect(await screen.findByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('employee')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
    );
  });
  it('displays API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Forbidden' } }),
    });
    render(<UsersPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });
});
