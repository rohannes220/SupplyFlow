import { describe, it, expect, vi, afterEach } from 'vitest';
import { listOrders, createOrder, ApiError } from './orderApi.js';

function mockFetch(status, body) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

afterEach(() => vi.restoreAllMocks());

describe('orderApi', () => {
  it('lists orders', async () => {
    mockFetch(200, [{ orderId: 1 }]);
    expect(await listOrders()).toEqual([{ orderId: 1 }]);
    expect(fetch).toHaveBeenCalledWith('/api/orders', expect.any(Object));
  });

  it('posts a new order as JSON', async () => {
    mockFetch(201, { orderId: 2 });
    expect(await createOrder({ vendorId: 3 })).toEqual({ orderId: 2 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/orders');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ vendorId: 3 });
  });

  it('throws ApiError with server field details', async () => {
    const details = [{ field: 'customerState', message: 'International orders are not accepted' }];
    mockFetch(400, { error: { message: 'Validation failed', details } });
    const err = await createOrder({}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Validation failed');
    expect(err.details).toEqual(details);
  });

  it('throws ApiError when the server is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await listOrders().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/could not reach/i);
  });
});
