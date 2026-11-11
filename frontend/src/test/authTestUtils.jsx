import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, TOKEN_STORAGE_KEY } from '../context/AuthContext.jsx';

export const adminUser = Object.freeze({
  id: 1,
  name: 'Demo Admin',
  email: 'admin@supplyflow.com',
  role: 'admin',
});

export const employeeUser = Object.freeze({
  id: 2,
  name: 'Demo Employee',
  email: 'employee@supplyflow.com',
  role: 'employee',
});

/** Fake authApi. getMe resolves to `user`, or rejects with 401 when user is null. */
export function fakeAuthApi(user = adminUser) {
  return {
    login: vi.fn().mockResolvedValue({ token: 'new-token', user }),
    getMe: vi.fn().mockImplementation(async () => {
      if (!user) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
      return user;
    }),
  };
}

/**
 * Renders `ui` at `route` inside AuthProvider + MemoryRouter. Passing `user` stores a token
 * so the provider restores that user via getMe, as it would after a page reload.
 * By default "/login" renders the marker text "Login screen" and every other path renders
 * `ui`; pass `routes` to supply your own <Routes>.
 */
export function renderWithAuth(
  ui,
  { user = null, api = fakeAuthApi(user), route = '/', routes } = {},
) {
  if (user) localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider api={api}>
        {routes ?? (
          <Routes>
            <Route path="/login" element={<p>Login screen</p>} />
            <Route path="*" element={ui} />
          </Routes>
        )}
      </AuthProvider>
    </MemoryRouter>,
  );
  return { ...utils, api };
}
