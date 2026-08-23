import type { GamePhase, RoomMode, RoundKind, RoomStatus } from '../types.js';

/** Полная колода расписного покера — 36 карт. */
export const DECK_SIZE = 36;

/** Играем только на чётное число игроков, чтобы колода раздавалась без остатка. */
export const ALLOWED_PLAYER_COUNTS = [2, 4, 6] as const;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const ROUND_KIND = {
  TRUMP: 'trump',
  NO_TRUMP: 'noTrump',
  DARK: 'dark',
  MISERE: 'misere',
  GOLD: 'gold',
} as const satisfies Record<string, RoundKind>;

/** Порядок специальных серий после основных раундов. */
export const SPECIAL_ORDER: RoundKind[] = [
  ROUND_KIND.NO_TRUMP,
  ROUND_KIND.DARK,
  ROUND_KIND.MISERE,
  ROUND_KIND.GOLD,
];

export interface RoundKindMeta {
  code: string;
  label: string;
  hint: string;
  /** Множитель очков: обычный x1, Б/Т/М x2, З x5. */
  multiplier: number;
  /** Есть ли в таком раунде заказ взяток. */
  hasBidding: boolean;
  color: string;
}

export const ROUND_KIND_META: Record<RoundKind, RoundKindMeta> = {
  trump: {
    code: '',
    label: 'Козырная',
    hint: 'Обычный раунд с козырем',
    multiplier: 1,
    hasBidding: true,
    color: '#93a4bd',
  },
  noTrump: {
    code: 'Б',
    label: 'Безкозырка',
    hint: 'Играем без козыря',
    multiplier: 2,
    hasBidding: true,
    color: '#60a5fa',
  },
  dark: {
    code: 'Т',
    label: 'Тёмные',
    hint: 'Заказ вслепую, не глядя в карты',
    multiplier: 2,
    hasBidding: true,
    color: '#a78bfa',
  },
  misere: {
    code: 'М',
    label: 'Мизера',
    hint: 'Заказа нет — все стараются не взять ни одной взятки',
    multiplier: 2,
    hasBidding: false,
    color: '#f472b6',
  },
  gold: {
    code: 'З',
    label: 'Золотые',
    hint: 'Всё то же, но очки в пять раз дороже',
    multiplier: 5,
    hasBidding: true,
    color: '#fbbf24',
  },
};

export const GAME_PHASE = {
  BIDDING: 'bidding',
  RESULTS: 'results',
  FINISHED: 'finished',
} as const satisfies Record<string, GamePhase>;

export const ROOM_MODE = {
  ONLINE: 'online',
  SINGLE: 'single',
} as const satisfies Record<string, RoomMode>;

export const ROOM_MODE_META: Record<RoomMode, { label: string; hint: string }> = {
  online: {
    label: 'Каждый со своего устройства',
    hint: 'Игроки заходят сами и делают заказ со своего телефона',
  },
  single: {
    label: 'Один ведёт стол',
    hint: 'Админ добавляет игроков руками и вводит заказы и взятки за всех',
  },
};

export const ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
} as const satisfies Record<string, RoomStatus>;

export const DEFAULT_ROOM_ID = 'default';
export const DEFAULT_ROOM_NAME = 'Общий стол';
