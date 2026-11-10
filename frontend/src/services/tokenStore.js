// The saved login token, shared by AuthContext (which manages it) and API clients (which send it).
export const TOKEN_STORAGE_KEY = 'supplyflow_token';

// Storage can throw (e.g. blocked in private mode); treat that as "no saved session".
export const tokenStore = {
  read() {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  write(token) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // The session still works until the page is reloaded.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Nothing stored to clear.
    }
  },
};
