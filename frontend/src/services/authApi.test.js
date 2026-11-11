import { describe, it, expect, vi, afterEach } from 'vitest';
import { login, getMe } from './authApi.js';
import { ApiError } from './orderApi.js';

function mockFetch(status, body) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

afterEach(() => vi.restoreAllMocks());

const user = { id: 1, name: 'Demo Admin', email: 'admin@supplyflow.com', role: 'admin' };

describe('authApi', () => {
  describe('login', () => {
    it('POSTs the credentials as JSON to /api/auth/login and returns token and user', async () => {
      mockFetch(200, { token: 'jwt-123', user });

      expect(await login('admin@supplyflow.com', 'secret')).toEqual({ token: 'jwt-123', user });
      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe('/api/auth/login');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual({ email: 'admin@supplyflow.com', password: 'secret' });
    });

    it("throws ApiError with the server's message on 401", async () => {
      mockFetch(401, { error: { message: 'Invalid email or password' } });

      const err = await login('admin@supplyflow.com', 'wrong').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(401);
      expect(err.message).toBe('Invalid email or password');
    });

    it('throws ApiError when the server is unreachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const err = await login('a@b.com', 'x').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toMatch(/could not reach/i);
    });
  });

  describe('getMe', () => {
    it('GETs /api/auth/me with a Bearer header and returns the user', async () => {
      mockFetch(200, user);

      expect(await getMe('jwt-123')).toEqual(user);
      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe('/api/auth/me');
      expect(init.method ?? 'GET').toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-123');
    });

    it('throws ApiError with status 401 for a rejected token', async () => {
      mockFetch(401, { error: { message: 'Invalid or expired token' } });
      const err = await getMe('expired').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(401);
    });
  });
});
