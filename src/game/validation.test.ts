import { describe, it, expect } from 'vitest';
import { bidContext, validateBid, validateTricks } from './validation.js';

const players = ['a', 'b', 'c', 'd'];
const base = { playerOrder: players, roundIndex: 0 };

describe('запрет на заказ для последнего игрока', () => {
  // В первом раунде раздаёт `a`, поэтому заказ идёт b -> c -> d -> a,
  // и последним заказывает раздающий.
  it('последний не может добить сумму до числа карт', () => {
    const args = { ...base, cards: 4, bids: { b: 1, c: 1, d: 1 }, uid: 'a' };
    const ctx = bidContext(args);
    expect(ctx.isLastBidder).toBe(true);
    expect(ctx.forbidden).toBe(1);
    expect(validateBid({ ...args, value: 1 }).ok).toBe(false);
    expect(validateBid({ ...args, value: 2 }).ok).toBe(true);
  });

  it('не последнему можно всё в пределах карт', () => {
    const ctx = bidContext({ ...base, cards: 4, bids: { b: 1 }, uid: 'c' });
    expect(ctx.isLastBidder).toBe(false);
    expect(ctx.forbidden).toBe(null);
    expect(ctx.options.every((o) => !o.disabled)).toBe(true);
  });

  it('запрета нет, если сумма заказов уже перебрала карты', () => {
    const ctx = bidContext({ ...base, cards: 4, bids: { b: 2, c: 2, d: 1 }, uid: 'a' });
    expect(ctx.forbidden).toBe(null);
  });

  it('вариантов заказа ровно на одну больше, чем карт', () => {
    const ctx = bidContext({ ...base, cards: 3, bids: {}, uid: 'a' });
    expect(ctx.options.map((o) => o.value)).toEqual([0, 1, 2, 3]);
  });

  it('заказ вне диапазона отклоняется', () => {
    expect(validateBid({ ...base, cards: 3, bids: {}, uid: 'a', value: 4 }).ok).toBe(false);
    expect(validateBid({ ...base, cards: 3, bids: {}, uid: 'a', value: -1 }).ok).toBe(false);
    expect(validateBid({ ...base, cards: 3, bids: {}, uid: 'a', value: 1.5 }).ok).toBe(false);
  });
});

describe('проверка взяток', () => {
  it('сумма должна равняться числу карт', () => {
    expect(validateTricks({ cards: 4, playerOrder: players, tricks: { a: 1, b: 1, c: 1, d: 1 } }).ok).toBe(true);
    expect(validateTricks({ cards: 4, playerOrder: players, tricks: { a: 1, b: 1, c: 1, d: 0 } }).ok).toBe(false);
  });

  it('пропущенное значение — ошибка', () => {
    expect(validateTricks({ cards: 4, playerOrder: players, tricks: { a: 4, b: 0, c: 0 } }).ok).toBe(false);
  });
});
