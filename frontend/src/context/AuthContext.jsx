import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../services/authApi.js';

export const TOKEN_STORAGE_KEY = 'supplyflow_token';

// Storage can throw (e.g. blocked in private mode); treat that as "no saved session".
const tokenStore = {
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

const AuthContext = createContext(null);

/** Holds the logged-in user and token, restoring a saved session on load. */
export function AuthProvider({ api = authApi, children }) {
  const [token, setToken] = useState(() => tokenStore.read());
  const [user, setUser] = useState(null);
  // A stored token must be checked with the server before we know who is logged in.
  const [isLoading, setIsLoading] = useState(() => Boolean(tokenStore.read()));

  useEffect(() => {
    const storedToken = tokenStore.read();
    if (!storedToken) return undefined;

    let active = true;
    api
      .getMe(storedToken)
      .then((currentUser) => active && setUser(currentUser))
      .catch(() => {
        if (!active) return;
        tokenStore.clear();
        setToken(null);
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [api]);

  const login = useCallback(
    async (email, password) => {
      const result = await api.login(email, password);
      tokenStore.write(result.token);
      setToken(result.token);
      setUser(result.user);
      return result.user;
    },
    [api],
  );

  const register = useCallback(
    async (name, email, password) => {
      const result = await api.register(name, email, password);
      tokenStore.write(result.token);
      setToken(result.token);
      setUser(result.user);
      return result.user;
    },
    [api],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout }),
    [user, token, isLoading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
