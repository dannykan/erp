import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

type Me = {
  id: number;
  username: string;
  display_name?: string;
  role: 'worker' | 'supervisor' | 'office' | 'admin' | string;
  is_active?: boolean;
};

type AuthState = {
  token: string | null;
  me: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

let inflight: Promise<void> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  async function refreshMe() {
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
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setMe(null);
  }

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ token, me, loading, refreshMe, logout }),
    [token, me, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}

