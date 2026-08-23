import { isFirebaseConfigured } from '../firebase/config.js';
import * as local from './localBackend.js';
import * as firebaseAuth from './auth.js';
import * as firebaseRooms from './rooms.js';
import * as firebaseGame from './game.js';

/**
 * Выбор бэкенда. Если .env заполнен — работаем через Firebase, иначе поднимаем
 * локальный режим на localStorage, чтобы приложение запускалось без настройки.
 *
 * Оба бэкенда используют одни и те же чистые правила из src/game, поэтому
 * различается только хранилище, а не поведение игры.
 */
export const backendKind: 'firebase' | 'local' = isFirebaseConfigured ? 'firebase' : 'local';

type Backend = typeof local;

const impl: Backend = isFirebaseConfigured
  ? ({ ...firebaseAuth, ...firebaseRooms, ...firebaseGame } as unknown as Backend)
  : local;

export const {
  // авторизация
  observeAuth,
  signInWithGoogle,
  signInAsGuest,
  signOut,
  toPlayerProfile,
  // комнаты
  ensureDefaultRoom,
  createRoom,
  subscribeRooms,
  subscribeRoom,
  joinRoom,
  leaveRoom,
  movePlayer,
  addPlayer,
  renamePlayer,
  removePlayer,
  renameRoom,
  updateRules,
  deleteRoom,
  // ходы
  startGame,
  submitBid,
  undoLastBid,
  submitRoundResults,
  undoLastRound,
  resetGame,
  archiveGame,
} = impl;
