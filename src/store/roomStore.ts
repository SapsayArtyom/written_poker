import { create } from 'zustand';
import {
  addPlayer,
  archiveGame,
  deleteRoom,
  joinRoom,
  leaveRoom,
  movePlayer,
  removePlayer,
  renamePlayer,
  renameRoom,
  resetGame,
  startGame,
  submitBid,
  submitRoundResults,
  subscribeRoom,
  undoLastBid,
  undoLastRound,
  updateRules,
} from '../services/backend.js';
import { humanizeError } from '../services/errors.js';
import type { Player, Room, Rules, Tricks, Uid, Unsubscribe } from '../types.js';

interface RoomState {
  roomId: string | null;
  room: Room | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notFound: boolean;
  unsubscribe: Unsubscribe | null;

  subscribe: (roomId: string) => void;
  dispose: () => void;
  clearError: () => void;

  join: (player: Player) => Promise<boolean>;
  leave: (uid: Uid) => Promise<boolean>;
  move: (uid: Uid, direction: number) => Promise<boolean>;
  addPlayer: (actorUid: Uid, name: string) => Promise<boolean>;
  renamePlayer: (actorUid: Uid, uid: Uid, name: string) => Promise<boolean>;
  removePlayer: (actorUid: Uid, uid: Uid) => Promise<boolean>;
  saveRules: (rules: Rules) => Promise<boolean>;
  start: (uid: Uid) => Promise<boolean>;
  bid: (input: { actorUid: Uid; targetUid: Uid; value: number }) => Promise<boolean>;
  undoBid: (uid: Uid) => Promise<boolean>;
  closeRound: (input: { actorUid: Uid; tricks: Tricks }) => Promise<boolean>;
  undoRound: (uid: Uid) => Promise<boolean>;
  reset: (uid: Uid) => Promise<boolean>;
  archive: (uid: Uid) => Promise<boolean>;
  rename: (uid: Uid, name: string) => Promise<boolean>;
  remove: (uid: Uid) => Promise<boolean>;
}

export const useRoomStore = create<RoomState>((set, get) => {
  /** Любое действие может упасть с понятным текстом — кладём его в error. */
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    set({ busy: true, error: null });
    try {
      await action();
      return true;
    } catch (e) {
      set({ error: humanizeError(e) });
      return false;
    } finally {
      set({ busy: false });
    }
  };

  const roomId = (): string => {
    const id = get().roomId;
    if (!id) throw new Error('Комната не выбрана');
    return id;
  };

  return {
    roomId: null,
    room: null,
    loading: true,
    busy: false,
    error: null,
    notFound: false,
    unsubscribe: null,

    subscribe(id) {
      if (get().roomId === id && get().unsubscribe) return;
      get().unsubscribe?.();
      set({ roomId: id, room: null, loading: true, notFound: false, error: null });

      const unsubscribe = subscribeRoom(
        id,
        (room) => set({ room, loading: false, notFound: room === null }),
        (e) => set({ error: humanizeError(e), loading: false }),
      );
      set({ unsubscribe });
    },

    dispose() {
      get().unsubscribe?.();
      set({ unsubscribe: null, roomId: null, room: null, loading: true, error: null });
    },

    clearError() {
      set({ error: null });
    },

    join: (player) => run(() => joinRoom(roomId(), player)),
    leave: (uid) => run(() => leaveRoom(roomId(), uid)),
    move: (uid, direction) => run(() => movePlayer(roomId(), uid, direction)),
    addPlayer: (actorUid, name) => run(() => addPlayer(roomId(), actorUid, name)),
    renamePlayer: (actorUid, uid, name) => run(() => renamePlayer(roomId(), actorUid, uid, name)),
    removePlayer: (actorUid, uid) => run(() => removePlayer(roomId(), actorUid, uid)),
    saveRules: (rules) => run(() => updateRules(roomId(), rules)),
    start: (uid) => run(() => startGame(roomId(), uid)),
    bid: (input) => run(() => submitBid(roomId(), input)),
    undoBid: (uid) => run(() => undoLastBid(roomId(), uid)),
    closeRound: (input) => run(() => submitRoundResults(roomId(), input)),
    undoRound: (uid) => run(() => undoLastRound(roomId(), uid)),
    reset: (uid) => run(() => resetGame(roomId(), uid)),
    archive: (uid) => run(() => archiveGame(roomId(), uid)),
    rename: (uid, name) => run(() => renameRoom(roomId(), uid, name)),
    remove: (uid) => run(() => deleteRoom(roomId(), uid)),
  };
});
