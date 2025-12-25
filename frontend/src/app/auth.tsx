import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from './api';
import { AuthContext, type AuthState, type Me } from './authContext';

let inflight: Promise<void> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = useCallback(async () => {
    if (inflight) return inflight;
    inflight = (async () => {
      const t = localStorage.getItem('token');
      setToken(t);
      if (!t) {
        setMe(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const m = await api.me();
        if (m.is_active === false) {
          // 帳號被停用：強制登出
          localStorage.removeItem('token');
          setToken(null);
          setMe(null);
          setLoading(false);
          return;
        }
        setMe(m);
      } catch {
        // token 無效或過期：清掉
        localStorage.removeItem('token');
        setToken(null);
        setMe(null);
      } finally {
        setLoading(false);
        inflight = null;
      }
    })();
    return inflight;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const value = useMemo(
    () => ({ token, me, loading, refreshMe, logout }),
    [token, me, loading, refreshMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

