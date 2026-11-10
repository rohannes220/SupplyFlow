import { ApiError } from './orderApi.js';
import { tokenStore } from './tokenStore.js';

// Copy of orderApi's request helper (orderApi doesn't export it).
// TODO(#4): move the shared request helper into services/apiClient.js for all API clients.
async function request(path, init = {}) {
  // Every vendor route requires login; read the token per call so a new login is picked up.
  const token = tokenStore.read();
  let res;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.error?.details ?? [],
    );
  }
  return body;
}

const sendJson = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Vendors sorted by name. `search` matches part of the name; `status` is Active or Inactive. */
export function listVendors({ search, status } = {}) {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  const query = params.toString();
  return request(query ? `/api/vendors?${query}` : '/api/vendors');
}

export function getVendor(id) {
  return request(`/api/vendors/${id}`);
}

/** Admin only. Throws ApiError 400 (field details), 403 or 409 (duplicate email). */
export function createVendor(input) {
  return request('/api/vendors', sendJson('POST', input));
}

/** Admin only. Setting status Inactive is how a vendor is deactivated. */
export function updateVendor(id, input) {
  return request(`/api/vendors/${id}`, sendJson('PUT', input));
}
