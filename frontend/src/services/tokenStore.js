// The saved login token, shared by AuthContext (which manages it) and API clients (which send it).
export const TOKEN_STORAGE_KEY = 'supplyflow_token';

let fallbackToken = null;

// Storage can throw (e.g. blocked in private mode); retain the active token in memory.
export const tokenStore = {
  read() {
    try {
      return fallbackToken ?? localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return fallbackToken;
    }
  },
  write(token) {
    fallbackToken = null;
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      fallbackToken = token;
    }
  },
  clear() {
    fallbackToken = null;
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Nothing stored to clear.
    }
  },
};
