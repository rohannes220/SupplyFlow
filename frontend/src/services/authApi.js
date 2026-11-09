import { ApiError } from './orderApi.js';

async function request(path, init = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.error?.details ?? [],
    );
  }
  return body;
}

/** Resolves to { token, user }. Throws ApiError (401 for bad credentials). */
export function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

/** Resolves to { token, user } for a new employee account. Throws ApiError (409 if email taken). */
export function register(name, email, password) {
  return request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
}

/** Resolves to the user the token belongs to. Throws ApiError (401 for a bad token). */
export function getMe(token) {
  return request('/api/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}
