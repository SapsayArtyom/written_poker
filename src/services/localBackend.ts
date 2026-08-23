import {
  DEFAULT_ROOM_ID,
  DEFAULT_ROOM_NAME,
  ROOM_MODE,
  ROOM_STATUS,
} from '../game/constants.js';
import { DEFAULT_RULES } from '../game/scoring.js';
import {
  addPlayerPatch,
  assertCanDeleteRoom,
  joinPatch,
  leavePatch,
  movePatch,
  removePlayerPatch,
  renamePlayerPatch,
  renameRoomPatch,
} from '../game/table.js';
import {
  applyPatch,
  bidPatch,
  closeRoundPatch,
  resetGamePatch,
  startGamePatch,
  undoBidPatch,
  undoRoundPatch,
  archiveGamePatch,
  type BidInput,
} from '../game/engine.js';
import type {
  AuthUser,
  Player,
  Room,
  RoomMode,
  RoomPatch,
  Rules,
  Tricks,
  Uid,
  Unsubscribe,
} from '../types.js';

/**
 * Локальный бэкенд без Firebase — чтобы приложение запускалось без настройки.
 *
 * Всё живёт в localStorage и синхронизируется между вкладками через событие
 * `storage`, поэтому многопользовательскую игру можно проверить, открыв
 * несколько окон браузера — в каждом свой игрок.
 *
 * Интерфейс совпадает с firebase-версией, а правила берутся из тех же чистых
 * функций в src/game, так что расхождений в подсчёте нет.
 */

const ROOMS_KEY = 'pokerhands:rooms';
const USER_KEY = 'pokerhands:user';

type RoomMap = Record<string, Room>;

const roomListeners = new Set<(rooms: RoomMap) => void>();

function readRooms(): RoomMap {
  try {
    return JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '{}') as RoomMap;
  } catch {
    return {};
  }
}

function notify(): void {
  const rooms = readRooms();
  for (const listener of roomListeners) listener(rooms);
}

function writeRooms(rooms: RoomMap): void {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  notify();
}

if (typeof window !== 'undefined') {
  // Правка из другой вкладки — тот же эффект, что снапшот из Firestore.
  window.addEventListener('storage', (e) => {
    if (e.key === ROOMS_KEY) notify();
  });
}

function subscribeAll(listener: (rooms: RoomMap) => void): Unsubscribe {
  roomListeners.add(listener);
  listener(readRooms());
  return () => roomListeners.delete(listener);
}

function newRoom({
  id,
  name,
  hostId = null,
  mode = ROOM_MODE.ONLINE,
  players = [],
  isDefault = false,
}: {
  id: string;
  name: string;
  hostId?: Uid | null;
  mode?: RoomMode;
  players?: Player[];
  isDefault?: boolean;
}): Room {
  return {
    id,
    name,
    mode,
    hostId,
    status: ROOM_STATUS.WAITING,
    players,
    rules: DEFAULT_RULES,
    game: null,
    history: [],
    isDefault,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------------- авторизация ---------------- */

let currentUser: AuthUser | null = null;
const authListeners = new Set<(user: AuthUser | null) => void>();

try {
  currentUser = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AuthUser | null;
} catch {
  currentUser = null;
}

function setUser(user: AuthUser | null): void {
  currentUser = user;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
  for (const listener of authListeners) listener(user);
}

export function observeAuth(callback: (user: AuthUser | null) => void): Unsubscribe {
  authListeners.add(callback);
  // Как и в Firebase — колбэк вызывается асинхронно после подписки.
  void Promise.resolve().then(() => callback(currentUser));
  return () => authListeners.delete(callback);
}

export function signInWithGoogle(): Promise<AuthUser> {
  return Promise.reject(new Error('Вход через Google доступен только с подключённым Firebase'));
}

export async function signInAsGuest(nickname?: string): Promise<AuthUser> {
  const uid = randomId('local');
  const user: AuthUser = {
    uid,
    displayName: nickname?.trim() || `Игрок-${uid.slice(6, 10)}`,
    photoURL: null,
    isAnonymous: true,
  };
  setUser(user);
  return user;
}

export async function signOut(): Promise<void> {
  setUser(null);
}

export function toPlayerProfile(user: AuthUser, nameOverride?: string): Player {
  return {
    uid: user.uid,
    name: nameOverride || user.displayName || `Игрок-${user.uid.slice(0, 4)}`,
    photoURL: user.photoURL ?? null,
    isGuest: true,
  };
}

/* ---------------- комнаты ---------------- */

export async function ensureDefaultRoom(): Promise<string> {
  const rooms = readRooms();
  if (!rooms[DEFAULT_ROOM_ID]) {
    rooms[DEFAULT_ROOM_ID] = newRoom({
      id: DEFAULT_ROOM_ID,
      name: DEFAULT_ROOM_NAME,
      isDefault: true,
    });
    writeRooms(rooms);
  }
  return DEFAULT_ROOM_ID;
}

export async function createRoom({
  name,
  user,
  mode = ROOM_MODE.ONLINE,
  players,
}: {
  name?: string;
  user: Pick<AuthUser, 'uid'>;
  mode?: RoomMode;
  players?: Player[];
}): Promise<string> {
  const id = randomId('room');
  const rooms = readRooms();
  rooms[id] = newRoom({
    id,
    name: name?.trim() || 'Новый стол',
    hostId: user.uid,
    mode,
    players,
  });
  writeRooms(rooms);
  return id;
}

export function subscribeRooms(
  callback: (rooms: Room[]) => void,
  _onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeAll((rooms) => {
    callback(
      Object.values(rooms).sort(
        (a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0),
      ),
    );
  });
}

export function subscribeRoom(
  roomId: string,
  callback: (room: Room | null) => void,
  _onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeAll((rooms) => callback(rooms[roomId] ?? null));
}

/** Аналог runTransaction: читаем комнату, считаем патч чистой функцией, пишем. */
export async function commitRoom(
  roomId: string,
  computePatch: (room: Room) => RoomPatch | null,
): Promise<void> {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) throw new Error('Комната не найдена');

  const patch = computePatch(room);
  if (!patch) return;

  rooms[roomId] = { ...applyPatch(room, patch), updatedAt: Date.now() };
  writeRooms(rooms);
}

export function joinRoom(roomId: string, player: Player): Promise<void> {
  return commitRoom(roomId, (room) => joinPatch(room, player));
}

export function leaveRoom(roomId: string, uid: Uid): Promise<void> {
  return commitRoom(roomId, (room) => leavePatch(room, uid));
}

export function movePlayer(roomId: string, uid: Uid, direction: number): Promise<void> {
  return commitRoom(roomId, (room) => movePatch(room, uid, direction));
}

export function addPlayer(roomId: string, actorUid: Uid, name: string): Promise<void> {
  return commitRoom(roomId, (room) => addPlayerPatch(room, actorUid, name));
}

export function renamePlayer(
  roomId: string,
  actorUid: Uid,
  uid: Uid,
  name: string,
): Promise<void> {
  return commitRoom(roomId, (room) => renamePlayerPatch(room, actorUid, uid, name));
}

export function removePlayer(roomId: string, actorUid: Uid, uid: Uid): Promise<void> {
  return commitRoom(roomId, (room) => removePlayerPatch(room, actorUid, uid));
}

export function renameRoom(roomId: string, actorUid: Uid, name: string): Promise<void> {
  return commitRoom(roomId, (room) => renameRoomPatch(room, actorUid, name));
}

export function updateRules(roomId: string, rules: Rules): Promise<void> {
  return commitRoom(roomId, () => ({ rules }));
}

export async function deleteRoom(roomId: string, actorUid: Uid): Promise<void> {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) return;
  assertCanDeleteRoom(room, actorUid);
  delete rooms[roomId];
  writeRooms(rooms);
}

/* ---------------- ходы ---------------- */

export function startGame(roomId: string, uid: Uid): Promise<void> {
  return commitRoom(roomId, (room) => startGamePatch(room, uid));
}

export function submitBid(roomId: string, input: BidInput): Promise<void> {
  return commitRoom(roomId, (room) => bidPatch(room, input));
}

export function undoLastBid(roomId: string, actorUid: Uid): Promise<void> {
  return commitRoom(roomId, (room) => undoBidPatch(room, actorUid));
}

export function submitRoundResults(
  roomId: string,
  input: { actorUid: Uid; tricks: Tricks },
): Promise<void> {
  return commitRoom(roomId, (room) => closeRoundPatch(room, input));
}

export function undoLastRound(roomId: string, actorUid: Uid): Promise<void> {
  return commitRoom(roomId, (room) => undoRoundPatch(room, actorUid));
}

export function resetGame(roomId: string, actorUid: Uid): Promise<void> {
  return commitRoom(roomId, (room) => resetGamePatch(room, actorUid));
}

export function archiveGame(roomId: string, actorUid: Uid): Promise<void> {
  return commitRoom(roomId, (room) => archiveGamePatch(room, actorUid));
}
