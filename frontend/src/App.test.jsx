// Wiring test: renders the real App (router, AuthProvider, services, pages). Only fetch is faked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { TOKEN_STORAGE_KEY } from './context/AuthContext.jsx';
import { adminUser } from './test/authTestUtils.jsx';

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** Fake backend: /api/auth/me accepts only "valid-token"; orders list is empty. */
function mockBackend() {
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    if (url === '/api/auth/me') {
      return init.headers?.Authorization === 'Bearer valid-token'
        ? json(200, adminUser)
        : json(401, { error: { message: 'Invalid or expired token' } });
    }
    if (url === '/api/orders') return json(200, []);
    return json(404, { error: { message: `Unexpected request ${url}` } });
  });
}

function renderAppAt(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  mockBackend();
});
afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('shows the login page when visiting "/" while logged out', async () => {
    renderAppAt('/');

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(screen.queryByRole('heading', { name: 'Purchase Orders' })).not.toBeInTheDocument();
  });

  it('shows the protected app at "/" with a valid stored token', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'valid-token');
    renderAppAt('/');

    expect(await screen.findByRole('heading', { name: 'Purchase Orders' })).toBeInTheDocument();
    expect(screen.getByText(adminUser.name)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
