import { describe, it, expect } from 'vitest';
import {
  buildRoundPlan,
  maxCardsPerPlayer,
  biddingOrder,
  currentBidderUid,
  dealerIndex,
  dealerUid,
  firstBidderIndex,
  roundLabel,
} from './rounds.js';
import { ROUND_KIND } from './constants.js';

describe('сетка раундов', () => {
  it('максимум карт на игрока', () => {
    expect(maxCardsPerPlayer(2)).toBe(18);
    expect(maxCardsPerPlayer(4)).toBe(9);
    expect(maxCardsPerPlayer(6)).toBe(6);
  });

  it('на 4 игроков совпадает с таблицей из ТЗ', () => {
    const plan = buildRoundPlan(4);
    const cards = plan.map((r) => r.cards);
    const codes = plan.map((r) => (r.kind === ROUND_KIND.TRUMP ? '.' : roundLabel(r).split(' ')[1]));

    expect(cards.slice(0, 20)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
      9, 9, 9,
      8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    expect(codes.slice(0, 20).every((c) => c === '.')).toBe(true);

    expect(codes.slice(20)).toEqual([
      'Б', 'Б', 'Б', 'Б',
      'Т', 'Т', 'Т', 'Т',
      'М', 'М', 'М', 'М',
      'З', 'З', 'З', 'З',
    ]);
    expect(cards.slice(20).every((c) => c === 9)).toBe(true);
    expect(plan).toHaveLength(36);
  });

  it('заказ есть везде, кроме мизеров', () => {
    for (const round of buildRoundPlan(4)) {
      expect(round.hasBidding).toBe(round.kind !== ROUND_KIND.MISERE);
    }
  });

  it('раздаётся не больше колоды', () => {
    for (const count of [2, 4, 6]) {
      for (const round of buildRoundPlan(count)) {
        expect(round.cards * count).toBeLessThanOrEqual(36);
      }
    }
  });

  it('раундов по максимуму карт ровно столько, сколько игроков', () => {
    for (const count of [2, 4, 6]) {
      const max = maxCardsPerPlayer(count);
      const mainRounds = buildRoundPlan(count).filter((r) => r.kind === ROUND_KIND.TRUMP);
      expect(mainRounds.filter((r) => r.cards === max)).toHaveLength(count);
    }
  });

  it('каждая спецсерия длится столько раундов, сколько игроков', () => {
    for (const count of [2, 4, 6]) {
      const plan = buildRoundPlan(count);
      for (const kind of ['noTrump', 'dark', 'misere', 'gold'] as const) {
        expect(plan.filter((r) => r.kind === kind)).toHaveLength(count);
      }
    }
  });

  it('длина игры', () => {
    expect(buildRoundPlan(6)).toHaveLength(16 + 24);
    expect(buildRoundPlan(4)).toHaveLength(20 + 16);
    expect(buildRoundPlan(2)).toHaveLength(36 + 8);
  });
});

describe('раздача и порядок заказа', () => {
  const players = ['a', 'b', 'c', 'd'];

  it('первый раунд раздаёт первый в списке, дальше по кругу', () => {
    expect(dealerIndex(0, 4)).toBe(0);
    expect(dealerIndex(1, 4)).toBe(1);
    expect(dealerIndex(4, 4)).toBe(0);
    expect(dealerUid(players, 0)).toBe('a');
    expect(dealerUid(players, 2)).toBe('c');
  });

  it('заказывать начинает следующий за раздающим', () => {
    expect(firstBidderIndex(0, 4)).toBe(1);
    expect(firstBidderIndex(3, 4)).toBe(0);
    expect(biddingOrder(players, 0)).toEqual(['b', 'c', 'd', 'a']);
    expect(biddingOrder(players, 1)).toEqual(['c', 'd', 'a', 'b']);
    expect(biddingOrder(players, 3)).toEqual(['a', 'b', 'c', 'd']);
    expect(biddingOrder(players, 4)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('раздающий заказывает последним', () => {
    for (let round = 0; round < 8; round += 1) {
      expect(biddingOrder(players, round).at(-1)).toBe(dealerUid(players, round));
    }
  });

  it('вдвоём раздача и заказ чередуются', () => {
    const pair = ['a', 'b'];
    expect(biddingOrder(pair, 0)).toEqual(['b', 'a']);
    expect(biddingOrder(pair, 1)).toEqual(['a', 'b']);
  });

  it('следующий заказывающий', () => {
    expect(currentBidderUid(players, 1, {})).toBe('c');
    expect(currentBidderUid(players, 1, { c: 1 })).toBe('d');
    expect(currentBidderUid(players, 1, { a: 0, b: 1, c: 2, d: 0 })).toBe(null);
  });
});
