import {
  ALLOWED_PLAYER_COUNTS,
  DECK_SIZE,
  ROUND_KIND,
  ROUND_KIND_META,
  SPECIAL_ORDER,
} from './constants.js';
import type { Bids, Round, RoundKind, Uid } from '../types.js';

/** Сколько карт максимум раздаётся на игрока: 2 -> 18, 4 -> 9, 6 -> 6. */
export function maxCardsPerPlayer(playerCount: number): number {
  return Math.floor(DECK_SIZE / playerCount);
}

export function isPlayerCountAllowed(playerCount: number): boolean {
  return (ALLOWED_PLAYER_COUNTS as readonly number[]).includes(playerCount);
}

/**
 * Полная сетка раундов на всю игру.
 *
 * Для 4 игроков (максимум 9 карт):
 *   1..9    — подъём по одной карте            (9 раундов)
 *   10..12  — плато: ещё playerCount-1 по 9    (3 раунда, всего 4 раунда по максимуму)
 *   13..20  — спуск 8..1                       (8 раундов)
 *   21..36  — Б, Т, М, З по playerCount каждая (16 раундов, все по 9 карт)
 */
export function buildRoundPlan(playerCount: number): Round[] {
  const max = maxCardsPerPlayer(playerCount);
  const rounds: Round[] = [];

  const push = (cards: number, kind: RoundKind, seriesIndex: number): void => {
    rounds.push({
      index: rounds.length,
      number: rounds.length + 1,
      cards,
      kind,
      seriesIndex,
      hasBidding: ROUND_KIND_META[kind].hasBidding,
    });
  };

  // Подъём: по 1, 2, 3 ... max карт.
  for (let cards = 1; cards <= max; cards += 1) push(cards, ROUND_KIND.TRUMP, cards - 1);

  // Плато: раздача по максимуму повторяется playerCount раз (по разу на каждого сдающего).
  for (let i = 1; i < playerCount; i += 1) push(max, ROUND_KIND.TRUMP, max - 1 + i);

  // Спуск: max-1 ... 1 карта.
  for (let cards = max - 1; cards >= 1; cards -= 1) {
    push(cards, ROUND_KIND.TRUMP, max - 1 + playerCount + (max - 1 - cards));
  }

  // Спецсерии: каждая длится playerCount раундов и всегда по максимуму карт.
  for (const kind of SPECIAL_ORDER) {
    for (let i = 0; i < playerCount; i += 1) push(max, kind, i);
  }

  return rounds;
}

/** Короткая подпись раунда: «9» для козырной, «9 Б» для безкозырки. */
export function roundLabel(round: Round): string {
  const meta = ROUND_KIND_META[round.kind];
  return meta.code ? `${round.cards} ${meta.code}` : String(round.cards);
}

/**
 * Кто раздаёт в этом раунде: первый раунд раздаёт первый игрок списка,
 * дальше сдача идёт по кругу.
 */
export function dealerIndex(roundIndex: number, playerCount: number): number {
  return ((roundIndex % playerCount) + playerCount) % playerCount;
}

/** Заказывать начинает следующий за раздающим. */
export function firstBidderIndex(roundIndex: number, playerCount: number): number {
  return (dealerIndex(roundIndex, playerCount) + 1) % playerCount;
}

export function dealerUid(playerOrder: Uid[], roundIndex: number): Uid {
  return playerOrder[dealerIndex(roundIndex, playerOrder.length)];
}

/** Порядок заказа в раунде: начиная с первого игрока раунда, дальше по кругу. */
export function biddingOrder(playerOrder: Uid[], roundIndex: number): Uid[] {
  const start = firstBidderIndex(roundIndex, playerOrder.length);
  return playerOrder.map((_, i) => playerOrder[(start + i) % playerOrder.length]);
}

/** Кто заказывает сейчас (null — все уже заказали). */
export function currentBidderUid(
  playerOrder: Uid[],
  roundIndex: number,
  bids: Bids = {},
): Uid | null {
  const order = biddingOrder(playerOrder, roundIndex);
  return order.find((uid) => bids[uid] === undefined) ?? null;
}
