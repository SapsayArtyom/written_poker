import { commitRoom } from './rooms.js';
import {
  startGamePatch,
  bidPatch,
  undoBidPatch,
  closeRoundPatch,
  undoRoundPatch,
  resetGamePatch,
  archiveGamePatch,
  type BidInput,
} from '../game/engine.js';
import type { Tricks, Uid } from '../types.js';

// Ходы идут той же транзакцией, что и операции со столом: читаем комнату,
// спрашиваем движок, что записать, и пишем. Правила живут в src/game/engine.ts.

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
