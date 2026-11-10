import { tokenStore } from './tokenStore.js';

export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, init = {}, token) {
  const authToken = token ?? tokenStore.read();
  let res;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}),
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

export function listOrders(token) {
  return request('/api/orders', {}, token);
}

export function createOrder(input, token) {
  return request(
    '/api/orders',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    token,
  );
}

export function updateOrder(orderId, input, token) {
  return request(
    `/api/orders/${orderId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    token,
  );
}

export function updateOrderStatus(orderId, status, token) {
  return request(
    `/api/orders/${orderId}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
    token,
  );
}

export function deleteOrder(orderId, token) {
  return request(`/api/orders/${orderId}`, { method: 'DELETE' }, token);
}
