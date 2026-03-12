import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { login as apiLogin, getMe } from '../api/auth';
import axiosInstance, { resolveApiUrl, setAuthToken } from '../api/axios';
import { notify } from '../utils/notify';

const readStoredExpiry = (key: string) => {
  try {
    const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
    return stored ? Number(stored) : null;
  } catch (_) {
    return null;
  }
};

const parseJwtExpiry = (token: string | null) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload && payload.exp) return Number(payload.exp) * 1000;
  } catch (_) {}
  return null;
};

const computeExpiryMs = (token: string | null, sessionExpiryKey: string) => {
  const jwtExp = parseJwtExpiry(token);
  if (jwtExp && Number.isFinite(jwtExp)) return jwtExp;
  return readStoredExpiry(sessionExpiryKey);
};

// lightweight server validation using fetch to avoid axios interceptors recursion
async function validateTokenSilently(): Promise<boolean> {
  try {
    const stored = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!stored) return false;
    const res = await fetch(resolveApiUrl('/api/users/me'), {
      headers: { Authorization: `Bearer ${stored}` },
      credentials: 'include',
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

type User = Record<string, any> | null;

type AuthContextType = {
  user: User;
  token: string | null;
  signin: (identifier: string, password: string) => Promise<User>;
  signout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const sessionExpiryKey = 'token_expiry_ms';
  const sessionTtlMs = 24 * 60 * 60 * 1000;

  const [user, setUser] = useState<User>(() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem('token') || sessionStorage.getItem('token') || null; } catch { return null; }
  });

  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearExpiryTimer() {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }

  function scheduleExpiry(expiryMs: number) {
    clearExpiryTimer();
    const now = Date.now();
    const delta = Math.max(0, expiryMs - now);
    expiryTimerRef.current = setTimeout(() => {
      // notify and signout when session expires
      try { notify.error('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại'); } catch (_) {}
      try { signout(); } catch (_) {}
    }, delta);
  }

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // attach interceptor once on mount
  const isSigningOutRef = useRef(false);
  const isValidatingRef = useRef(false);
  useEffect(() => {
    const interceptorId = axiosInstance.interceptors.response.use(
      (res) => res,
      async (error) => {
        const status = error?.response?.status;
        const reqUrl = error?.config?.url || '';

        // Ignore auth endpoints to avoid loops
        if (reqUrl.includes('/api/auth')) return Promise.reject(error);

        if (status !== 401) return Promise.reject(error);

        // For 401, decide whether to sign out. Strategy:
        // 1) If token expired locally -> sign out immediately.
        // 2) Else, validate token once by calling getMe(); if validation fails -> sign out.
        const expiryMs = computeExpiryMs(token, sessionExpiryKey);
        const now = Date.now();

        if (expiryMs && expiryMs <= now) {
          if (!isSigningOutRef.current) {
            isSigningOutRef.current = true;
            notify.error('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại');
            try { signout(); } catch (_) {}
            setTimeout(() => { isSigningOutRef.current = false; }, 1500);
          }
          return Promise.reject(error);
        }

        // Token not expired locally: validate once to confirm server-side validity.
        if (isValidatingRef.current) return Promise.reject(error);
        isValidatingRef.current = true;
        try {
          const ok = await validateTokenSilently();
          isValidatingRef.current = false;
          if (ok) return Promise.reject(error);
          throw new Error('validation failed');
        } catch (e) {
          isValidatingRef.current = false;
          if (!isSigningOutRef.current) {
            isSigningOutRef.current = true;
            notify.error('Phiên đăng nhập không hợp lệ', 'Vui lòng đăng nhập lại');
            try { signout(); } catch (_) {}
            setTimeout(() => { isSigningOutRef.current = false; }, 1500);
          }
          return Promise.reject(error);
        }
      }
    );

    return () => {
      try { axiosInstance.interceptors.response.eject(interceptorId); } catch (_) {}
      clearExpiryTimer();
    };
  }, []);

  // Sync token/user across tabs: when localStorage changes in another tab, update state here.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      try {
        if (e.key === 'token') {
          const newToken = e.newValue;
          if (newToken !== token) {
            setToken(newToken);
          }
        }
        if (e.key === 'user') {
          const newUser = e.newValue ? JSON.parse(e.newValue) : null;
          setUser(newUser);
        }
        if (e.key === sessionExpiryKey) {
          const exp = e.newValue ? Number(e.newValue) : null;
          if (exp && Number.isFinite(exp)) scheduleExpiry(exp);
        }
      } catch (_) {}
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [token]);

  // validate token whenever it changes
  useEffect(() => {
    clearExpiryTimer();
    setAuthToken(token);

    if (!token) {
      setUser(null);
      localStorage.removeItem(sessionExpiryKey);
      sessionStorage.removeItem(sessionExpiryKey);
      return;
    }

    const jwtExp = parseJwtExpiry(token);
    if (jwtExp && Number.isFinite(jwtExp)) {
      scheduleExpiry(jwtExp);
      try { localStorage.setItem(sessionExpiryKey, String(jwtExp)); } catch (_) {}
    } else {
      const sessionExpiry = readStoredExpiry(sessionExpiryKey);
      const expMs = sessionExpiry ? Number(sessionExpiry) : Date.now() + sessionTtlMs;
      scheduleExpiry(expMs);
      try { localStorage.setItem(sessionExpiryKey, String(expMs)); } catch (_) {}
    }

    const validateAndLoad = async () => {
      try {
        const me = await getMe();
        setUser(me);
        try { localStorage.setItem('user', JSON.stringify(me)); } catch (_) {}
      } catch (err) {
        const expiryMs = computeExpiryMs(token, sessionExpiryKey);
        const now = Date.now();
        if (expiryMs && expiryMs <= now) {
          if (!isSigningOutRef.current) {
            isSigningOutRef.current = true;
            notify.error('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại');
            try { signout(); } catch (_) {}
            setTimeout(() => { isSigningOutRef.current = false; }, 1500);
          }
        }
      }
    };

    validateAndLoad();
  }, [token]);


  async function signin(identifier: string, password: string) {
    const data = await apiLogin(identifier, password);
    // persist into both storages: prefer localStorage so other tabs/windows can read it
    try { localStorage.setItem('token', data.token); } catch (_) {}
    try { sessionStorage.setItem('token', data.token); } catch (_) {}
    try { localStorage.setItem('user', JSON.stringify(data.user)); } catch (_) {}
    try { sessionStorage.setItem('user', JSON.stringify(data.user)); } catch (_) {}
    const expiry = Date.now() + sessionTtlMs;
    try { localStorage.setItem(sessionExpiryKey, String(expiry)); } catch (_) {}
    try { sessionStorage.setItem(sessionExpiryKey, String(expiry)); } catch (_) {}
    scheduleExpiry(expiry);
    setToken(data.token);
    setUser(data.user);
    return data.user as any;
  }

  function signout() {
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem(sessionExpiryKey); } catch (_) {}
    try { sessionStorage.removeItem('token'); sessionStorage.removeItem('user'); sessionStorage.removeItem(sessionExpiryKey); } catch (_) {}
    clearExpiryTimer();
    setToken(null);
    setUser(null);
    setAuthToken(undefined);
  }

  async function refresh() {
    if (!token) return;
    try {
      const me = await getMe();
      setUser(me);
      try { localStorage.setItem('user', JSON.stringify(me)); } catch (_) {}
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, signin, signout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
