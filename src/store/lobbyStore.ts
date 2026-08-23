import { create } from 'zustand';
import { createRoom, ensureDefaultRoom, subscribeRooms } from '../services/backend.js';
import { humanizeError } from '../services/errors.js';
import type { Player, Room, RoomMode, Unsubscribe } from '../types.js';

interface LobbyState {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  unsubscribe: Unsubscribe | null;
  init: () => Promise<void>;
  dispose: () => void;
  create: (name: string, user: Player, mode: RoomMode) => Promise<string | null>;
  clearError: () => void;
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  rooms: [],
  loading: true,
  error: null,
  unsubscribe: null,

  async init() {
    if (get().unsubscribe) return;
    try {
      await ensureDefaultRoom();
    } catch (e) {
      set({ error: humanizeError(e) });
    }
    const unsubscribe = subscribeRooms(
      (rooms) => set({ rooms, loading: false, error: null }),
      (e) => set({ error: humanizeError(e), loading: false }),
    );
    set({ unsubscribe });
  },

  dispose() {
    get().unsubscribe?.();
    set({ unsubscribe: null, rooms: [], loading: true });
  },

  async create(name, user, mode) {
    set({ error: null });
    try {
      // В режиме «один ведёт стол» админ сразу садится за стол первым игроком —
      // его можно переименовать или убрать, если он только считает.
      const players: Player[] =
        mode === 'single'
          ? [{ uid: 'p1', name: user.name, photoURL: null, isGuest: true, isLocal: true }]
          : [];
      return await createRoom({ name, user, mode, players });
    } catch (e) {
      set({ error: humanizeError(e) });
      return null;
    }
  },

  clearError() {
    set({ error: null });
  },
}));
