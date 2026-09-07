'use client';

import { create } from 'zustand';
import { api, setToken } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string | null;
  companyName: string | null;
  subscriptionStatus: string | null;
  licenseType: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  init: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vectracom_token') : null;
    if (!token) { set({ token: null, user: null }); return; }
    set({ token });
    await get().fetchMe();
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', { email, password });
      setToken(res.accessToken);
      set({ user: res.user, token: res.accessToken, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Erreur de connexion', loading: false });
      throw err;
    }
  },

  logout: () => {
    setToken(null);
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const me = await api.get<AuthUser>('/auth/me');
      set({ user: me });
    } catch {
      setToken(null);
      set({ user: null, token: null });
    }
  },
}));
