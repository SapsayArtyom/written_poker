import { MAX_PLAYERS, ROOM_MODE, ROOM_STATUS } from './constants.js';
import type { Player, Room, RoomPatch, Uid } from '../types.js';

/**
 * Чистые операции с составом стола (вне игры).
 * Как и engine.ts — возвращают поля для записи или null, если менять нечего,
 * и бросают Error с текстом для игрока.
 */

const MAX_NAME = 24;

function assertNotPlaying(room: Room, what: string): void {
  if (room.status === ROOM_STATUS.PLAYING) throw new Error(`Игра идёт — ${what} нельзя`);
}

function assertAdmin(room: Room, uid: Uid): void {
  if (room.hostId !== uid) throw new Error('Состав стола меняет только админ');
}

function normalizeName(name: string, players: Player[], skipUid?: Uid): string {
  const clean = name.trim().slice(0, MAX_NAME);
  if (!clean) throw new Error('Имя игрока не может быть пустым');

  const clash = players.find(
    (p) => p.uid !== skipUid && p.name.toLowerCase() === clean.toLowerCase(),
  );
  if (clash) throw new Error(`За столом уже есть ${clash.name} — имена должны различаться`);

  return clean;
}

/* ---------------- режим «каждый со своего устройства» ---------------- */

export function joinPatch(room: Room, player: Player): RoomPatch | null {
  if (room.mode === ROOM_MODE.SINGLE) {
    throw new Error('За этим столом игроков добавляет админ');
  }
  const players = room.players ?? [];
  if (players.some((p) => p.uid === player.uid)) return null; // уже за столом
  if (room.status === ROOM_STATUS.PLAYING) throw new Error('Игра уже идёт, дождитесь конца');
  if (players.length >= MAX_PLAYERS) throw new Error(`За столом максимум ${MAX_PLAYERS} игроков`);

  return {
    players: [...players, player],
    hostId: room.hostId ?? player.uid,
  };
}

export function leavePatch(room: Room, uid: Uid): RoomPatch {
  if (room.status === ROOM_STATUS.PLAYING) {
    throw new Error('Нельзя выйти из-за стола посреди игры — сначала завершите или сбросьте игру');
  }
  const players = (room.players ?? []).filter((p) => p.uid !== uid);
  return {
    players,
    hostId: room.hostId === uid ? (players[0]?.uid ?? null) : room.hostId,
  };
}

/* ---------------- режим «один ведёт стол» ---------------- */

/** Уникальный идентификатор для игрока, добавленного руками. */
export function localPlayerUid(room: Room): Uid {
  const taken = new Set((room.players ?? []).map((p) => p.uid));
  for (let i = 1; i <= MAX_PLAYERS + 1; i += 1) {
    const uid = `p${i}`;
    if (!taken.has(uid)) return uid;
  }
  throw new Error('Свободных мест за столом нет');
}

/** Админ добавляет игрока — только имя, аккаунт ему не нужен. */
export function addPlayerPatch(room: Room, actorUid: Uid, name: string): RoomPatch {
  assertAdmin(room, actorUid);
  assertNotPlaying(room, 'добавлять игроков');

  const players = room.players ?? [];
  if (players.length >= MAX_PLAYERS) throw new Error(`За столом максимум ${MAX_PLAYERS} игроков`);

  const player: Player = {
    uid: localPlayerUid(room),
    name: normalizeName(name, players),
    photoURL: null,
    isGuest: true,
    isLocal: true,
  };
  return { players: [...players, player] };
}

export function renamePlayerPatch(
  room: Room,
  actorUid: Uid,
  uid: Uid,
  name: string,
): RoomPatch | null {
  assertAdmin(room, actorUid);

  const players = room.players ?? [];
  const target = players.find((p) => p.uid === uid);
  if (!target) throw new Error('Такого игрока за столом нет');

  const clean = normalizeName(name, players, uid);
  if (clean === target.name) return null;

  return { players: players.map((p) => (p.uid === uid ? { ...p, name: clean } : p)) };
}

export function removePlayerPatch(room: Room, actorUid: Uid, uid: Uid): RoomPatch {
  assertAdmin(room, actorUid);
  assertNotPlaying(room, 'убирать игроков');

  const players = room.players ?? [];
  if (!players.some((p) => p.uid === uid)) throw new Error('Такого игрока за столом нет');
  if (uid === room.hostId) throw new Error('Админа убрать нельзя');

  return { players: players.filter((p) => p.uid !== uid) };
}

/* ---------------- общее ---------------- */

const MAX_ROOM_NAME = 40;

/** Переименование стола — в любой момент, включая идущую партию. */
export function renameRoomPatch(room: Room, actorUid: Uid, name: string): RoomPatch | null {
  if (room.hostId !== actorUid) throw new Error('Переименовать стол может только админ');

  const clean = name.trim().slice(0, MAX_ROOM_NAME);
  if (!clean) throw new Error('Название стола не может быть пустым');
  if (clean === room.name) return null;

  return { name: clean };
}

/** Удалить стол может только админ и только когда партия не идёт. */
export function assertCanDeleteRoom(room: Room, actorUid: Uid): void {
  if (room.hostId !== actorUid) throw new Error('Удалить стол может только админ');
  if (room.status === ROOM_STATUS.PLAYING) {
    throw new Error('Идёт партия — сначала закройте или сбросьте её');
  }
}

/** Порядок массива players — это порядок хода по кругу. */
export function movePatch(room: Room, uid: Uid, direction: number): RoomPatch | null {
  assertNotPlaying(room, 'менять порядок');

  const players = [...(room.players ?? [])];
  const from = players.findIndex((p) => p.uid === uid);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= players.length) return null;

  [players[from], players[to]] = [players[to], players[from]];
  return { players };
}
