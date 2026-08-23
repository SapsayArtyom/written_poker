import { biddingOrder } from './rounds.js';
import type { BidContext, BidOption, Bids, Tricks, Uid } from '../types.js';

export type Check = { ok: true } | { ok: false; error: string };

/**
 * Запрещённый заказ для последнего игрока раунда.
 * Сумма всех заказов не может быть равна числу розданных карт, поэтому
 * последний заказывающий не имеет права назвать ровно недостающее число.
 */
export function forbiddenBid({
  cards,
  otherBidsSum,
  isLastBidder,
}: {
  cards: number;
  otherBidsSum: number;
  isLastBidder: boolean;
}): number | null {
  if (!isLastBidder) return null;
  const value = cards - otherBidsSum;
  return value >= 0 && value <= cards ? value : null;
}

export interface BidContextInput {
  playerOrder: Uid[];
  roundIndex: number;
  cards: number;
  bids?: Bids;
  uid: Uid;
}

/** Что игрок вправе назвать прямо сейчас. */
export function bidContext({
  playerOrder,
  roundIndex,
  cards,
  bids = {},
  uid,
}: BidContextInput): BidContext {
  const order = biddingOrder(playerOrder, roundIndex);
  const position = order.indexOf(uid);
  const isLastBidder = position === order.length - 1;
  const otherBidsSum = Object.entries(bids)
    .filter(([id]) => id !== uid)
    .reduce((sum, [, value]) => sum + (value ?? 0), 0);

  const forbidden = forbiddenBid({ cards, otherBidsSum, isLastBidder });
  const options: BidOption[] = [];
  for (let value = 0; value <= cards; value += 1) {
    options.push({ value, disabled: value === forbidden });
  }

  return { order, position, isLastBidder, otherBidsSum, forbidden, options };
}

export function validateBid({
  playerOrder,
  roundIndex,
  cards,
  bids,
  uid,
  value,
}: BidContextInput & { value: number }): Check {
  if (!Number.isInteger(value) || value < 0 || value > cards) {
    return { ok: false, error: `Заказ должен быть числом от 0 до ${cards}` };
  }
  const { forbidden } = bidContext({ playerOrder, roundIndex, cards, bids, uid });
  if (forbidden !== null && value === forbidden) {
    return {
      ok: false,
      error: `Нельзя заказать ${value}: сумма заказов станет равна числу карт (${cards})`,
    };
  }
  return { ok: true };
}

/** Сумма взятых взяток обязана совпадать с числом розданных карт. */
export function validateTricks({
  cards,
  playerOrder,
  tricks,
}: {
  cards: number;
  playerOrder: Uid[];
  tricks: Tricks;
}): Check {
  for (const uid of playerOrder) {
    const value = tricks?.[uid];
    if (!Number.isInteger(value) || value < 0 || value > cards) {
      return { ok: false, error: 'У каждого игрока должно быть указано число взяток' };
    }
  }
  const sum = playerOrder.reduce((acc, uid) => acc + tricks[uid], 0);
  if (sum !== cards) {
    return { ok: false, error: `Сумма взяток должна быть ровно ${cards}, сейчас ${sum}` };
  }
  return { ok: true };
}
