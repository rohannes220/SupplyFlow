// Wiring test for the dashboard: real App (router, AuthProvider, services, pages). Only fetch is faked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { TOKEN_STORAGE_KEY } from './context/AuthContext.jsx';
import { adminUser } from './test/authTestUtils.jsx';

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const metrics = (totalOrders) => ({
  totalOrders,
  pendingOrders: 0,
  activeVendors: 0,
  totalSpending: 0,
  overdueDeliveries: null,
  ordersByStatus: { Draft: 0, Pending: 0, Approved: 0, Shipped: 0, Delivered: 0, Cancelled: 0 },
  recentOrders: [],
});

/** Fake backend for a logged-in admin. Each dashboard request reports one more order. */
function mockBackend() {
  let dashboardCalls = 0;
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const authed = init.headers?.Authorization === 'Bearer valid-token';
    if (!authed) return json(401, { error: { message: 'Authentication required' } });
    if (url === '/api/auth/me') return json(200, adminUser);
    if (url === '/api/dashboard') return json(200, metrics((dashboardCalls += 1)));
    if (url === '/api/orders') return json(200, []);
    return json(404, { error: { message: `Unexpected request ${url}` } });
  });
}

const dashboardRequests = () => fetch.mock.calls.filter(([url]) => url === '/api/dashboard');

function renderAppAt(path) {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'valid-token');
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  mockBackend();
});
afterEach(() => vi.restoreAllMocks());

describe('App dashboard routing', () => {
  it('shows the Dashboard at "/" after login', async () => {
    renderAppAt('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('shows Purchase Orders at /orders', async () => {
    renderAppAt('/orders');
    expect(await screen.findByRole('heading', { name: 'Purchase Orders' })).toBeInTheDocument();
    expect(dashboardRequests()).toHaveLength(0);
  });

  it('lists Dashboard first in the sidebar', async () => {
    renderAppAt('/');
    const nav = within(await screen.findByRole('navigation', { name: /main/i }));
    expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Dashboard',
      'Purchase Orders',
      'Vendors',
    ]);
  });

  it('refetches the metrics each time the dashboard is opened', async () => {
    const user = userEvent.setup();
    renderAppAt('/');
    const nav = within(await screen.findByRole('navigation', { name: /main/i }));
    expect(await screen.findByRole('group', { name: 'Total Orders' })).toHaveTextContent('1');

    await user.click(nav.getByRole('link', { name: 'Purchase Orders' }));
    await screen.findByRole('heading', { name: 'Purchase Orders' });
    await user.click(nav.getByRole('link', { name: 'Dashboard' }));

    expect(await screen.findByRole('group', { name: 'Total Orders' })).toHaveTextContent('2');
    expect(dashboardRequests()).toHaveLength(2);
  });
});
