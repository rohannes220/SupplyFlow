import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listVendors, getVendor, createVendor, updateVendor } from './vendorApi.js';
import { ApiError } from './orderApi.js';
import { TOKEN_STORAGE_KEY } from './tokenStore.js';

const vendor = {
  id: 1,
  name: 'Global Parts Co.',
  email: 'sarah@globalparts.example',
  phone: '4045550142',
  city: 'Atlanta',
  state: 'GA',
  status: 'Active',
};

function mockFetch(status, body) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const lastCall = () => {
  const [url, init = {}] = fetch.mock.calls.at(-1);
  const parsed = new URL(url, 'http://localhost');
  return { url, path: parsed.pathname, params: parsed.searchParams, init };
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('vendorApi', () => {
  describe('listVendors', () => {
    it('GETs /api/vendors with no query string when no filters are given', async () => {
      mockFetch(200, [vendor]);
      expect(await listVendors()).toEqual([vendor]);
      const { url, init } = lastCall();
      expect(url).toBe('/api/vendors');
      expect(init.method ?? 'GET').toBe('GET');
    });

    it('sends search and status as encoded query parameters', async () => {
      mockFetch(200, []);
      await listVendors({ search: 'Tech & Co', status: 'Inactive' });
      const { path, params } = lastCall();
      expect(path).toBe('/api/vendors');
      expect(params.get('search')).toBe('Tech & Co');
      expect(params.get('status')).toBe('Inactive');
    });

    it('leaves out blank search and an "All" (empty) status', async () => {
      mockFetch(200, []);
      await listVendors({ search: '   ', status: '' });
      expect(lastCall().url).toBe('/api/vendors');
    });
  });

  it('getVendor GETs /api/vendors/:id', async () => {
    mockFetch(200, vendor);
    expect(await getVendor(1)).toEqual(vendor);
    expect(lastCall().url).toBe('/api/vendors/1');
  });

  it('createVendor POSTs the vendor as JSON', async () => {
    mockFetch(201, vendor);
    const input = { name: 'Global Parts Co.', email: 'sarah@globalparts.example' };
    expect(await createVendor(input)).toEqual(vendor);
    const { url, init } = lastCall();
    expect(url).toBe('/api/vendors');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it('updateVendor PUTs the vendor as JSON to /api/vendors/:id', async () => {
    mockFetch(200, { ...vendor, status: 'Inactive' });
    await updateVendor(1, { ...vendor, status: 'Inactive' });
    const { url, init } = lastCall();
    expect(url).toBe('/api/vendors/1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toMatchObject({ status: 'Inactive' });
  });

  describe('authentication', () => {
    it.each([
      ['listVendors', () => listVendors()],
      ['getVendor', () => getVendor(1)],
      ['createVendor', () => createVendor({})],
      ['updateVendor', () => updateVendor(1, {})],
    ])('%s sends the stored token as a Bearer header', async (_name, call) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, 'jwt-abc');
      mockFetch(200, {});
      await call();
      expect(lastCall().init.headers.Authorization).toBe('Bearer jwt-abc');
    });

    it('sends no Authorization header when nobody is logged in', async () => {
      mockFetch(200, []);
      await listVendors();
      expect(lastCall().init.headers ?? {}).not.toHaveProperty('Authorization');
    });
  });

  describe('errors', () => {
    it('throws ApiError with server field details on 400', async () => {
      const details = [{ field: 'phone', message: 'Phone must be a 10-digit US number' }];
      mockFetch(400, { error: { message: 'Validation failed', details } });
      const err = await createVendor({}).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(400);
      expect(err.details).toEqual(details);
    });

    it.each([
      [401, 'Authentication required'],
      [403, 'You do not have permission to perform this action'],
      [404, 'Vendor 99 not found'],
      [409, 'A vendor with this email already exists'],
    ])('throws ApiError with status %i and the server message', async (status, message) => {
      mockFetch(status, { error: { message } });
      const err = await getVendor(99).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ status, message });
    });

    it('throws ApiError when the server is unreachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const err = await listVendors().catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toMatch(/could not reach/i);
    });
  });
});
