// Wiring test for /vendors: real App (router, AuthProvider, services, pages). Only fetch is faked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { TOKEN_STORAGE_KEY } from './context/AuthContext.jsx';
import { adminUser, employeeUser } from './test/authTestUtils.jsx';

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const vendors = [
  {
    id: 1,
    name: 'Global Parts Co.',
    email: 'sarah@globalparts.example',
    phone: '4045550142',
    city: 'Atlanta',
    state: 'GA',
    status: 'Active',
  },
];

/** Fake backend: "admin-token" and "employee-token" log in as those users. */
function mockBackend() {
  const users = { 'Bearer admin-token': adminUser, 'Bearer employee-token': employeeUser };
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const user = users[init.headers?.Authorization];
    if (url.startsWith('/api/') && url !== '/api/auth/login' && !user) {
      return json(401, { error: { message: 'Authentication required' } });
    }
    if (url === '/api/auth/me') return json(200, user);
    if (url.startsWith('/api/vendors')) return json(200, vendors);
    if (url === '/api/orders') return json(200, []);
    return json(404, { error: { message: `Unexpected request ${url}` } });
  });
}

function renderAppAt(path, token) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  mockBackend();
});
afterEach(() => vi.restoreAllMocks());

describe('App /vendors route', () => {
  it('sends a logged-out visitor from /vendors to the login page', async () => {
    renderAppAt('/vendors');
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it.each([
    ['admin', 'admin-token'],
    ['employee', 'employee-token'],
  ])('shows the Vendors page inside the layout for a logged-in %s', async (_role, token) => {
    renderAppAt('/vendors', token);
    expect(await screen.findByRole('heading', { name: 'Vendors' })).toBeInTheDocument();
    expect(await screen.findByText('Global Parts Co.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/vendors');
  });

  it('navigates from the orders page to vendors with the sidebar link', async () => {
    const user = userEvent.setup();
    renderAppAt('/orders', 'employee-token');
    const nav = within(await screen.findByRole('navigation', { name: /main/i }));

    await user.click(nav.getByRole('link', { name: 'Vendors' }));

    expect(await screen.findByRole('heading', { name: 'Vendors' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/vendors');
  });
});
