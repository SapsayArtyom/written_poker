export type Uid = string;

export interface Player {
  uid: Uid;
  name: string;
  photoURL: string | null;
  isGuest: boolean;
  /** Игрок, которого админ добавил вручную: своего аккаунта у него нет. */
  isLocal?: boolean;
}

/**
 * Режим стола.
 *  online — каждый играет со своего устройства и сам делает заказ;
 *  single — всё ведёт один админ с одного устройства, игроков он добавляет руками.
 */
export type RoomMode = 'online' | 'single';

/** Тип раунда: обычный козырный или одна из спецсерий. */
export type RoundKind = 'trump' | 'noTrump' | 'dark' | 'misere' | 'gold';

export interface Round {
  index: number;
  number: number;
  cards: number;
  kind: RoundKind;
  /** Номер раунда внутри своей серии — для подписей. */
  seriesIndex: number;
  /** В мизерах заказа нет: все играют на минимум взяток. */
  hasBidding: boolean;
}

export type GamePhase = 'bidding' | 'results' | 'finished';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Rules {
  /** Очки за одну заказанную и взятую взятку. */
  trickValue: number;
  /** Очки за успешный пас. */
  passValue: number;
  /** Штраф за каждую невзятую из заказанных. */
  undertrickValue: number;
  /** Очки за каждую взятку сверх заказа (и за взятки при несдержанном пасе). */
  extraTrickValue: number;
  /** Умножать ли лишние взятки на множитель раунда. */
  multiplyExtras: boolean;
  /** Штраф за каждую взятку в мизерах. */
  misereTrickPenalty: number;
}

export type Scores = Record<Uid, number>;
export type Bids = Record<Uid, number>;
export type Tricks = Record<Uid, number>;

export interface HistoryEntry {
  roundIndex: number;
  number: number;
  cards: number;
  kind: RoundKind;
  bids: Bids;
  tricks: Tricks;
  scores: Scores;
  closedAt: number;
  closedBy: Uid;
}

/** Итог одного игрока в завершённой партии. */
export interface GameResult {
  uid: Uid;
  name: string;
  total: number;
  place: number;
}

/**
 * Завершённая партия в архиве стола.
 * Храним сводку, а не всю расписку: столов с десятками партий документ
 * Firestore иначе быстро распухнет.
 */
export interface FinishedGame {
  number: number;
  startedAt: number;
  finishedAt: number;
  rounds: number;
  playerOrder: Uid[];
  results: GameResult[];
}

export interface GameState {
  playerOrder: Uid[];
  roundIndex: number;
  phase: GamePhase;
  bids: Bids;
  tricks: Tricks;
  startedAt: number;
  finishedAt: number | null;
}

export interface Room {
  id: string;
  name: string;
  mode: RoomMode;
  hostId: Uid | null;
  status: RoomStatus;
  players: Player[];
  rules: Rules;
  game: GameState | null;
  history: HistoryEntry[];
  /** Архив завершённых партий этого стола. */
  games?: FinishedGame[];
  isDefault?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Набор полей для записи. Ключи вида `game.bids` Firestore понимает как
 * точечные пути; локальный бэкенд разворачивает их в applyPatch.
 */
export type RoomPatch = Record<string, unknown>;

/** Профиль авторизованного пользователя в терминах приложения. */
export interface AuthUser {
  uid: Uid;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

export interface BidOption {
  value: number;
  disabled: boolean;
}

export interface BidContext {
  order: Uid[];
  position: number;
  isLastBidder: boolean;
  otherBidsSum: number;
  forbidden: number | null;
  options: BidOption[];
}

export type Unsubscribe = () => void;
