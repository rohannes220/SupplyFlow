import { request } from './apiClient.js';

/** Dashboard metrics (any logged-in user). Computed fresh by the server on every call. */
export function getDashboard() {
  return request('/api/dashboard');
}
