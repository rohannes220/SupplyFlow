// /api/orders requires login (#2): every order request must carry the stored JWT.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listOrders, createOrder, updateOrderStatus, deleteOrder } from './orderApi.js';
import { TOKEN_STORAGE_KEY } from '../context/AuthContext.jsx';

function mockFetch(status = 200, body = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const CALLS = [
  ['listOrders', () => listOrders()],
  ['createOrder', () => createOrder({ vendorId: 3 })],
  ['updateOrderStatus', () => updateOrderStatus(7, 'Pending')],
  ['deleteOrder', () => deleteOrder(7)],
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('orderApi authentication', () => {
  it.each(CALLS)('%s sends the stored token as a Bearer header', async (_name, call) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jwt-abc');
    mockFetch();

    await call();

    const [, init] = fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer jwt-abc');
  });

  it('keeps the JSON Content-Type alongside the token', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jwt-abc');
    mockFetch(201, { orderId: 1 });

    await createOrder({ vendorId: 3 });

    const [, init] = fetch.mock.calls[0];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer jwt-abc',
      'Content-Type': 'application/json',
    });
  });

  it('reads the token at call time, so a fresh login is picked up', async () => {
    mockFetch(200, []);
    localStorage.setItem(TOKEN_STORAGE_KEY, 'first');
    await listOrders();
    localStorage.setItem(TOKEN_STORAGE_KEY, 'second');
    await listOrders();

    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer second');
  });

  it('sends no Authorization header when nobody is logged in', async () => {
    mockFetch(200, []);
    await listOrders();
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('surfaces a 401 as an ApiError with status 401', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'expired');
    mockFetch(401, { error: { message: 'Invalid or expired token' } });
    await expect(listOrders()).rejects.toMatchObject({ status: 401 });
  });
});
