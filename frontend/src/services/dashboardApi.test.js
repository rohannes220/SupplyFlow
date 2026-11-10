import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDashboard } from './dashboardApi.js';
import { ApiError } from './orderApi.js';
import { TOKEN_STORAGE_KEY } from './tokenStore.js';

function mockFetch(status, body) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const metrics = { totalOrders: 3, pendingOrders: 1, overdueDeliveries: null };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('dashboardApi.getDashboard', () => {
  it('GETs /api/dashboard and returns the metrics', async () => {
    mockFetch(200, metrics);
    expect(await getDashboard()).toEqual(metrics);
    const [url, init = {}] = fetch.mock.calls[0];
    expect(url).toBe('/api/dashboard');
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('sends the stored token as a Bearer header', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jwt-abc');
    mockFetch(200, metrics);
    await getDashboard();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-abc');
  });

  it('throws ApiError with status 401 when the session has expired', async () => {
    mockFetch(401, { error: { message: 'Invalid or expired token' } });
    const err = await getDashboard().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: 'Invalid or expired token' });
  });

  it('throws ApiError when the server is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await getDashboard().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/could not reach/i);
  });
});
