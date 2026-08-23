import { describe, it, expect } from 'vitest';
import { scorePlayerRound, scoreRound, computeTotals, standings } from './scoring.js';
import { ROUND_KIND } from './constants.js';
import type { Player, RoundKind } from '../types.js';

const T = ROUND_KIND.TRUMP;

describe('очки за раунд (примеры из ТЗ)', () => {
  it('заказал 1, взял 1 -> 10', () => {
    expect(scorePlayerRound({ bid: 1, taken: 1, kind: T })).toBe(10);
  });

  it('пас и не взял -> 5', () => {
    expect(scorePlayerRound({ bid: 0, taken: 0, kind: T })).toBe(5);
  });

  it('заказал 2, взял 1 -> -10 (недобор в одну взятку)', () => {
    expect(scorePlayerRound({ bid: 2, taken: 1, kind: T })).toBe(-10);
  });

  it('заказал 3, взял 3 -> 30', () => {
    expect(scorePlayerRound({ bid: 3, taken: 3, kind: T })).toBe(30);
  });

  it('недобор в две взятки -> -20', () => {
    expect(scorePlayerRound({ bid: 3, taken: 1, kind: T })).toBe(-20);
  });

  it('перебор: заказ оплачен + 1 очко за лишнюю взятку', () => {
    expect(scorePlayerRound({ bid: 2, taken: 3, kind: T })).toBe(21);
    expect(scorePlayerRound({ bid: 2, taken: 4, kind: T })).toBe(22);
  });

  it('пас не удержан: по 1 очку за каждую взятку', () => {
    expect(scorePlayerRound({ bid: 0, taken: 1, kind: T })).toBe(1);
    expect(scorePlayerRound({ bid: 0, taken: 3, kind: T })).toBe(3);
  });
});

describe('множители спецраундов', () => {
  it('Б и Т — x2', () => {
    for (const kind of [ROUND_KIND.NO_TRUMP, ROUND_KIND.DARK] as RoundKind[]) {
      expect(scorePlayerRound({ bid: 1, taken: 1, kind })).toBe(20);
      expect(scorePlayerRound({ bid: 0, taken: 0, kind })).toBe(10);
      expect(scorePlayerRound({ bid: 2, taken: 1, kind })).toBe(-20);
    }
  });

  it('З (золотые) — x5', () => {
    const kind = ROUND_KIND.GOLD;
    expect(scorePlayerRound({ bid: 1, taken: 1, kind })).toBe(50);
    expect(scorePlayerRound({ bid: 0, taken: 0, kind })).toBe(25);
    expect(scorePlayerRound({ bid: 2, taken: 1, kind })).toBe(-50);
  });

  it('лишние взятки множитель не увеличивает', () => {
    expect(scorePlayerRound({ bid: 1, taken: 2, kind: ROUND_KIND.GOLD })).toBe(51);
    expect(scorePlayerRound({ bid: 0, taken: 2, kind: ROUND_KIND.GOLD })).toBe(2);
  });
});

describe('мизера: заказа нет, взятки штрафуются', () => {
  const kind = ROUND_KIND.MISERE;

  it('не взял ни одной -> 10 (пас с множителем 2)', () => {
    expect(scorePlayerRound({ bid: 0, taken: 0, kind })).toBe(10);
  });

  it('каждая взятка -> -20', () => {
    expect(scorePlayerRound({ bid: 0, taken: 1, kind })).toBe(-20);
    expect(scorePlayerRound({ bid: 0, taken: 3, kind })).toBe(-60);
  });

  it('заказ не влияет на очки — его в мизерах не бывает', () => {
    expect(scorePlayerRound({ bid: 5, taken: 0, kind })).toBe(10);
    expect(scorePlayerRound({ bid: 5, taken: 2, kind })).toBe(-40);
  });
});

describe('правила переопределяются', () => {
  it('перебор можно обнулить', () => {
    expect(scorePlayerRound({ bid: 2, taken: 3, kind: T, rules: { extraTrickValue: 0 } })).toBe(20);
  });

  it('штраф в мизерах настраивается', () => {
    expect(
      scorePlayerRound({ bid: 0, taken: 1, kind: ROUND_KIND.MISERE, rules: { misereTrickPenalty: 5 } }),
    ).toBe(-10);
  });
});

describe('итоги', () => {
  const playerOrder = ['a', 'b'];

  it('раунд целиком', () => {
    const scores = scoreRound({
      round: { kind: T },
      playerOrder,
      bids: { a: 1, b: 0 },
      tricks: { a: 1, b: 1 },
    });
    expect(scores).toEqual({ a: 10, b: 1 });
  });

  it('мизерный раунд целиком — заказы игнорируются', () => {
    const scores = scoreRound({
      round: { kind: ROUND_KIND.MISERE },
      playerOrder,
      bids: {},
      tricks: { a: 0, b: 2 },
    });
    expect(scores).toEqual({ a: 10, b: -40 });
  });

  it('сумма по истории и распределение мест', () => {
    const history = [
      { scores: { a: 10, b: 5 } },
      { scores: { a: -10, b: 20 } },
    ] as never;
    const totals = computeTotals(history, playerOrder);
    expect(totals).toEqual({ a: 0, b: 25 });

    const players: Player[] = [
      { uid: 'a', name: 'A', photoURL: null, isGuest: false },
      { uid: 'b', name: 'B', photoURL: null, isGuest: false },
    ];
    expect(standings(totals, players).map((p) => [p.name, p.place])).toEqual([
      ['B', 1],
      ['A', 2],
    ]);
  });

  it('равные суммы делят место', () => {
    const players: Player[] = [
      { uid: 'a', name: 'A', photoURL: null, isGuest: false },
      { uid: 'b', name: 'B', photoURL: null, isGuest: false },
      { uid: 'c', name: 'C', photoURL: null, isGuest: false },
    ];
    const table = standings({ a: 10, b: 10, c: 5 }, players);
    expect(table.map((p) => p.place)).toEqual([1, 1, 3]);
  });
});
