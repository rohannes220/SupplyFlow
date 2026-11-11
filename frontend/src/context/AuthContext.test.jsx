import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, TOKEN_STORAGE_KEY } from './AuthContext.jsx';
import { adminUser, employeeUser, fakeAuthApi } from '../test/authTestUtils.jsx';

function renderAuth(api) {
  const wrapper = ({ children }) => <AuthProvider api={api}>{children}</AuthProvider>;
  return renderHook(() => useAuth(), { wrapper });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('AuthProvider / useAuth', () => {
  it('uses the "supplyflow_token" localStorage key', () => {
    expect(TOKEN_STORAGE_KEY).toBe('supplyflow_token');
  });

  it('starts logged out without calling getMe when no token is stored', () => {
    const api = fakeAuthApi();
    const { result } = renderAuth(api);

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(api.getMe).not.toHaveBeenCalled();
  });

  it('login calls the API, stores the token and sets the user', async () => {
    const api = fakeAuthApi(employeeUser);
    const { result } = renderAuth(api);

    await act(() => result.current.login('employee@supplyflow.com', 'pw'));

    expect(api.login).toHaveBeenCalledWith('employee@supplyflow.com', 'pw');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('new-token');
    expect(result.current.token).toBe('new-token');
    expect(result.current.user).toEqual(employeeUser);
  });

  it('login rethrows API errors and leaves the user logged out', async () => {
    const api = fakeAuthApi();
    api.login.mockRejectedValue(
      Object.assign(new Error('Invalid email or password'), { status: 401 }),
    );
    const { result } = renderAuth(api);

    await act(async () => {
      await expect(result.current.login('admin@supplyflow.com', 'wrong')).rejects.toThrow(
        'Invalid email or password',
      );
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('restores the user from a stored token on load', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    const api = fakeAuthApi(adminUser);
    const { result } = renderAuth(api);

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.getMe).toHaveBeenCalledWith('stored-token');
    expect(result.current.user).toEqual(adminUser);
    expect(result.current.token).toBe('stored-token');
  });

  it('clears the stored token if getMe fails on load', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    const api = fakeAuthApi(null);
    const { result } = renderAuth(api);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('logout clears the token and user', async () => {
    const { result } = renderAuth(fakeAuthApi());
    await act(() => result.current.login('admin@supplyflow.com', 'pw'));

    act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('throws a helpful error when useAuth is used outside AuthProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
