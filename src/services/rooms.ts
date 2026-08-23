import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentReference,
} from 'firebase/firestore';
import { requireDb } from '../firebase/config.js';
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
import type {
  AuthUser,
  Player,
  Room,
  RoomMode,
  RoomPatch,
  Rules,
  Uid,
  Unsubscribe,
} from '../types.js';

const ROOMS = 'rooms';

export function roomRef(roomId: string): DocumentReference {
  return doc(requireDb(), ROOMS, roomId);
}

export function emptyRoom({
  name,
  hostId,
  mode = ROOM_MODE.ONLINE,
  players = [],
}: {
  name: string;
  hostId: Uid | null;
  mode?: RoomMode;
  players?: Player[];
}) {
  return {
    name,
    mode,
    hostId,
    status: ROOM_STATUS.WAITING,
    players,
    rules: DEFAULT_RULES,
    game: null,
    history: [],
  };
}

/** Дефолтная комната есть всегда — создаём при первом заходе в лобби. */
export async function ensureDefaultRoom(): Promise<string> {
  const ref = roomRef(DEFAULT_ROOM_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...emptyRoom({ name: DEFAULT_ROOM_NAME, hostId: null }),
      isDefault: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
  const ref = doc(collection(requireDb(), ROOMS));
  await setDoc(ref, {
    ...emptyRoom({ name: name?.trim() || 'Новый стол', hostId: user.uid, mode, players }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeRooms(
  callback: (rooms: Room[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(requireDb(), ROOMS), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Room)),
    onError,
  );
}

export function subscribeRoom(
  roomId: string,
  callback: (room: Room | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    roomRef(roomId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Room) : null),
    onError,
  );
}

/** Транзакция «прочитать комнату → спросить чистую функцию → записать». */
export async function commitRoom(
  roomId: string,
  computePatch: (room: Room) => RoomPatch | null,
): Promise<void> {
  await runTransaction(requireDb(), async (tx) => {
    const ref = roomRef(roomId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Комната не найдена');

    const patch = computePatch({ id: snap.id, ...snap.data() } as Room);
    if (!patch) return; // менять нечего
    tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
  });
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

export async function updateRules(roomId: string, rules: Rules): Promise<void> {
  await updateDoc(roomRef(roomId), { rules, updatedAt: serverTimestamp() });
}

export async function deleteRoom(roomId: string, actorUid: Uid): Promise<void> {
  const snap = await getDoc(roomRef(roomId));
  if (!snap.exists()) return;
  assertCanDeleteRoom({ id: snap.id, ...snap.data() } as Room, actorUid);
  await deleteDoc(roomRef(roomId));
}
