import { createContext } from 'react';

export type Me = {
  id: number;
  username: string;
  display_name?: string;
  role: 'worker' | 'supervisor' | 'office' | 'admin' | string;
  is_active?: boolean;
};

export type AuthState = {
  token: string | null;
  me: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthState | null>(null);

