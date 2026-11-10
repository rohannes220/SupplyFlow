import { request } from './apiClient.js';

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
