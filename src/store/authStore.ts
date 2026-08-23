import { create } from 'zustand';
import {
  observeAuth,
  signInAsGuest,
  signInWithGoogle,
  signOut,
  toPlayerProfile,
} from '../services/backend.js';
import { humanizeError } from '../services/errors.js';
import type { Player, Unsubscribe } from '../types.js';

interface AuthState {
  user: Player | null;
  loading: boolean;
  error: string | null;
  unsubscribe: Unsubscribe | null;
  init: () => void;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: (nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  unsubscribe: null,

  init() {
    if (get().unsubscribe) return;
    const unsubscribe = observeAuth((user) => {
      set({ user: user ? toPlayerProfile(user) : null, loading: false });
    });
    set({ unsubscribe });
  },

  async loginWithGoogle() {
    set({ error: null });
    try {
      await signInWithGoogle();
    } catch (e) {
      set({ error: humanizeError(e) });
    }
  },

  async loginAsGuest(nickname) {
    set({ error: null });
    try {
      const user = await signInAsGuest(nickname);
      // Смена имени не всегда триггерит слушателя — ставим профиль сразу.
      if (user) set({ user: toPlayerProfile(user), loading: false });
    } catch (e) {
      set({ error: humanizeError(e) });
    }
  },

  async logout() {
    set({ error: null });
    try {
      await signOut();
      set({ user: null });
    } catch (e) {
      set({ error: humanizeError(e) });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

