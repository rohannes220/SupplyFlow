import { ApiError } from './orderApi.js';
import { tokenStore } from './tokenStore.js';

/**
 * Shared fetch wrapper for the API clients: sends the stored Bearer token (read per call, so a
 * new login is picked up), parses JSON, and turns failures into ApiError.
 * TODO(#4): orderApi.js and authApi.js still have their own copies; switch them to this.
 */
export async function request(path, init = {}) {
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
