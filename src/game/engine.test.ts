import { describe, it, expect } from 'vitest';
import {
  startGamePatch,
  bidPatch,
  undoBidPatch,
  closeRoundPatch,
  undoRoundPatch,
  resetGamePatch,
  archiveGamePatch,
  nextGameNumber,
  applyPatch,
  planFor,
} from './engine.js';
import { selectRoomView } from './view.js';
import { biddingOrder, currentBidderUid } from './rounds.js';
import { computeTotals, DEFAULT_RULES } from './scoring.js';
import { GAME_PHASE, ROOM_MODE, ROOM_STATUS, ROUND_KIND } from './constants.js';
import type { Room, Tricks, Uid } from '../types.js';

const NAMES = ['Аня', 'Боря', 'Вера', 'Гоша', 'Дима', 'Егор'];

function makeRoom(count = 4): Room {
  return {
    id: 'r1',
    name: 'Стол',
    mode: ROOM_MODE.ONLINE,
    hostId: 'u0',
    status: ROOM_STATUS.WAITING,
    players: Array.from({ length: count }, (_, i) => ({
      uid: `u${i}`,
      name: NAMES[i] ?? `Игрок ${i + 1}`,
      photoURL: null,
      isGuest: false,
    })),
    rules: DEFAULT_RULES,
    game: null,
    history: [],
  };
}

function started(count = 4): Room {
  const room = makeRoom(count);
  return applyPatch(room, startGamePatch(room, 'u0'));
}

/** Первый допустимый заказ для игрока, чья очередь. */
function pickBid(room: Room, uid: Uid): number {
  const view = selectRoomView(room, uid);
  const options = view!.game!.bidContext!.options.filter((o) => !o.disabled);
  return options[0].value;
}

/** Раскладывает взятки так, чтобы сумма была ровно cards. */
function spreadTricks(playerOrder: Uid[], cards: number): Tricks {
  const tricks: Tricks = Object.fromEntries(playerOrder.map((uid) => [uid, 0]));
  for (let i = 0; i < cards; i += 1) {
    tricks[playerOrder[i % playerOrder.length]] += 1;
  }
  return tricks;
}

/** Играет всю партию от начала до конца. */
function playFullGame(count: number): Room {
  let room = started(count);
  const plan = planFor(room);

  for (const round of plan) {
    expect(room.game!.roundIndex).toBe(round.index);

    if (round.hasBidding) {
      expect(room.game!.phase).toBe(GAME_PHASE.BIDDING);
      for (const uid of biddingOrder(room.game!.playerOrder, round.index)) {
        room = applyPatch(room, bidPatch(room, { actorUid: uid, targetUid: uid, value: pickBid(room, uid) }));
      }
    }

    expect(room.game!.phase).toBe(GAME_PHASE.RESULTS);
    const tricks = spreadTricks(room.game!.playerOrder, round.cards);
    room = applyPatch(room, closeRoundPatch(room, { actorUid: 'u0', tricks }));
  }

  return room;
}

describe('старт игры', () => {
  it('фиксирует порядок игроков и первый раунд', () => {
    const room = started();
    expect(room.status).toBe(ROOM_STATUS.PLAYING);
    expect(room.game!.playerOrder).toEqual(['u0', 'u1', 'u2', 'u3']);
    expect(room.game!.roundIndex).toBe(0);
    expect(room.game!.phase).toBe(GAME_PHASE.BIDDING);
  });

  it('нечётный состав не пускает', () => {
    expect(() => startGamePatch(makeRoom(3), 'u0')).toThrow(/чётное число/);
  });

  it('стартовать может только хост', () => {
    expect(() => startGamePatch(makeRoom(4), 'u1')).toThrow(/хост/);
  });

  it('посторонний не может стартовать', () => {
    expect(() => startGamePatch(makeRoom(4), 'stranger')).toThrow(/только хост/);
  });
});

describe('заказ взяток', () => {
  /** Порядок заказа в первом раунде: раздаёт u0, значит начинает u1. */
  const ORDER = ['u1', 'u2', 'u3', 'u0'];

  it('заказ начинается со следующего за раздающим', () => {
    expect(biddingOrder(started().game!.playerOrder, 0)).toEqual(ORDER);
  });

  it('нельзя заказывать вне очереди', () => {
    const room = started();
    expect(() => bidPatch(room, { actorUid: 'u2', targetUid: 'u2', value: 1 })).toThrow(
      /заказывает другой игрок/,
    );
  });

  it('хост может ввести заказ за игрока, чья очередь', () => {
    let room = started();
    room = applyPatch(room, bidPatch(room, { actorUid: 'u0', targetUid: 'u1', value: 0 }));
    room = applyPatch(room, bidPatch(room, { actorUid: 'u0', targetUid: 'u2', value: 0 }));
    expect(room.game!.bids).toEqual({ u1: 0, u2: 0 });
  });

  it('не хост не может заказывать за другого', () => {
    let room = started();
    room = applyPatch(room, bidPatch(room, { actorUid: 'u1', targetUid: 'u1', value: 0 }));
    expect(() => bidPatch(room, { actorUid: 'u1', targetUid: 'u2', value: 0 })).toThrow(
      /не ваша очередь/,
    );
  });

  it('раздающий заказывает последним и не может добить сумму до числа карт', () => {
    // Первый раунд — одна карта. Трое пасуют, раздающему нельзя заказать 1.
    let room = started();
    for (const uid of ORDER.slice(0, 3)) {
      room = applyPatch(room, bidPatch(room, { actorUid: uid, targetUid: uid, value: 0 }));
    }
    expect(() => bidPatch(room, { actorUid: 'u0', targetUid: 'u0', value: 1 })).toThrow(
      /сумма заказов/,
    );
    room = applyPatch(room, bidPatch(room, { actorUid: 'u0', targetUid: 'u0', value: 0 }));
    expect(room.game!.phase).toBe(GAME_PHASE.RESULTS);
  });

  it('после всех заказов фаза меняется на подсчёт взяток', () => {
    let room = started();
    for (const uid of ORDER) {
      room = applyPatch(room, bidPatch(room, { actorUid: uid, targetUid: uid, value: 0 }));
    }
    expect(currentBidderUid(room.game!.playerOrder, 0, room.game!.bids)).toBe(null);
    expect(room.game!.phase).toBe(GAME_PHASE.RESULTS);
  });

  it('отмена последнего заказа возвращает ход', () => {
    let room = started();
    room = applyPatch(room, bidPatch(room, { actorUid: 'u1', targetUid: 'u1', value: 0 }));
    room = applyPatch(room, bidPatch(room, { actorUid: 'u2', targetUid: 'u2', value: 1 }));
    room = applyPatch(room, undoBidPatch(room, 'u0'));
    expect(room.game!.bids).toEqual({ u1: 0 });
    expect(currentBidderUid(room.game!.playerOrder, 0, room.game!.bids)).toBe('u2');
  });

  it('отменять заказ может только хост', () => {
    let room = started();
    room = applyPatch(room, bidPatch(room, { actorUid: 'u1', targetUid: 'u1', value: 0 }));
    expect(() => undoBidPatch(room, 'u1')).toThrow(/хост/);
  });
});

describe('закрытие раунда', () => {
  function atResults(): Room {
    // Раунд 1, одна карта. Раздаёт u0, поэтому заказ идёт u1 -> u2 -> u3 -> u0:
    // u1 заказывает 1, u2 и u3 пасуют, раздающему остаётся заказать 1.
    let room = started();
    for (const [uid, value] of [['u1', 1], ['u2', 0], ['u3', 0], ['u0', 1]] as const) {
      room = applyPatch(room, bidPatch(room, { actorUid: uid, targetUid: uid, value }));
    }
    return room;
  }

  it('сумма взяток должна совпасть с числом карт', () => {
    const room = atResults();
    expect(() =>
      closeRoundPatch(room, { actorUid: 'u0', tricks: { u0: 0, u1: 0, u2: 0, u3: 0 } }),
    ).toThrow(/должна быть ровно 1/);
  });

  it('считает очки и переходит к следующему раунду', () => {
    let room = atResults();
    room = applyPatch(
      room,
      closeRoundPatch(room, { actorUid: 'u0', tricks: { u1: 1, u0: 0, u2: 0, u3: 0 } }),
    );

    expect(room.history[0].scores).toEqual({ u1: 10, u2: 5, u3: 5, u0: -10 });
    expect(room.game!.roundIndex).toBe(1);
    expect(room.game!.phase).toBe(GAME_PHASE.BIDDING);
    expect(room.game!.bids).toEqual({});
  });

  it('откат раунда возвращает заказы и фазу подсчёта', () => {
    let room = atResults();
    room = applyPatch(
      room,
      closeRoundPatch(room, { actorUid: 'u0', tricks: { u1: 1, u0: 0, u2: 0, u3: 0 } }),
    );
    room = applyPatch(room, undoRoundPatch(room, 'u0'));

    expect(room.history).toHaveLength(0);
    expect(room.game!.roundIndex).toBe(0);
    expect(room.game!.phase).toBe(GAME_PHASE.RESULTS);
    expect(room.game!.bids).toEqual({ u1: 1, u2: 0, u3: 0, u0: 1 });
  });
});

describe('мизера', () => {
  /** Доводит игру до первого мизерного раунда. */
  function atMisere(): Room {
    let room = started();
    const plan = planFor(room);
    const target = plan.findIndex((r) => r.kind === ROUND_KIND.MISERE);

    for (let i = 0; i < target; i += 1) {
      const round = plan[i];
      if (round.hasBidding) {
        for (const uid of biddingOrder(room.game!.playerOrder, i)) {
          room = applyPatch(room, bidPatch(room, { actorUid: uid, targetUid: uid, value: pickBid(room, uid) }));
        }
      }
      room = applyPatch(
        room,
        closeRoundPatch(room, {
          actorUid: 'u0',
          tricks: spreadTricks(room.game!.playerOrder, round.cards),
        }),
      );
    }
    return room;
  }

  it('раунд открывается сразу на подсчёте взяток, без заказа', () => {
    const room = atMisere();
    expect(planFor(room)[room.game!.roundIndex].kind).toBe(ROUND_KIND.MISERE);
    expect(room.game!.phase).toBe(GAME_PHASE.RESULTS);
    expect(room.game!.bids).toEqual({});
  });

  it('заказать в мизерах нельзя', () => {
    const room = atMisere();
    expect(() => bidPatch(room, { actorUid: 'u0', targetUid: 'u0', value: 1 })).toThrow(
      /не фаза заказа/,
    );
  });

  it('очки: кто не взял — плюс 10, взятки по -20', () => {
    let room = atMisere();
    room = applyPatch(
      room,
      closeRoundPatch(room, { actorUid: 'u0', tricks: { u0: 9, u1: 0, u2: 0, u3: 0 } }),
    );
    const entry = room.history.at(-1)!;
    expect(entry.kind).toBe(ROUND_KIND.MISERE);
    expect(entry.scores).toEqual({ u0: -180, u1: 10, u2: 10, u3: 10 });
  });

  it('во вью нет активного заказывающего', () => {
    const view = selectRoomView(atMisere(), 'u0')!;
    expect(view.game!.activeBidder).toBe(null);
    expect(view.game!.isMyTurn).toBe(false);
    expect(view.game!.bidContext).toBe(null);
    expect(view.game!.round.hasBidding).toBe(false);
  });
});

describe('полная партия', () => {
  it('4 игрока: 36 раундов, игра закрывается', () => {
    const room = playFullGame(4);
    expect(room.history).toHaveLength(36);
    expect(room.status).toBe(ROOM_STATUS.FINISHED);
    expect(room.game!.phase).toBe(GAME_PHASE.FINISHED);
  });

  it('6 игроков: 40 раундов', () => {
    expect(playFullGame(6).history).toHaveLength(40);
  });

  it('2 игрока: 44 раунда', () => {
    expect(playFullGame(2).history).toHaveLength(44);
  });

  it('в каждом раунде с заказом сумма заказов не равна числу карт, взяток — равна', () => {
    for (const entry of playFullGame(4).history) {
      const bids = Object.values(entry.bids).reduce((a, b) => a + b, 0);
      const tricks = Object.values(entry.tricks).reduce((a, b) => a + b, 0);
      if (entry.kind !== ROUND_KIND.MISERE) expect(bids).not.toBe(entry.cards);
      expect(tricks).toBe(entry.cards);
    }
  });

  it('в мизерных раундах истории заказов нет', () => {
    const misere = playFullGame(4).history.filter((e) => e.kind === ROUND_KIND.MISERE);
    expect(misere).toHaveLength(4);
    for (const entry of misere) expect(entry.bids).toEqual({});
  });

  it('итоговая таблица сходится с суммой по раундам', () => {
    const room = playFullGame(4);
    const view = selectRoomView(room, 'u0')!;
    expect(view.totals).toEqual(computeTotals(room.history, room.game!.playerOrder));
    expect(view.standings).toHaveLength(4);
    expect(view.standings[0].total).toBeGreaterThanOrEqual(view.standings[3].total);
  });

  it('сброс возвращает стол в ожидание, состав сохраняется', () => {
    const room = playFullGame(4);
    const reset = applyPatch(room, resetGamePatch(room, 'u0'));
    expect(reset.status).toBe(ROOM_STATUS.WAITING);
    expect(reset.game).toBe(null);
    expect(reset.history).toHaveLength(0);
    expect(reset.players).toHaveLength(4);
  });
});

describe('производное состояние для UI', () => {
  it('до старта игры отдаёт стол без игры', () => {
    const view = selectRoomView(makeRoom(4), 'u0')!;
    expect(view.game).toBe(null);
    expect(view.isHost).toBe(true);
    expect(view.amAtTable).toBe(true);
  });

  it('в игре знает, чей ход, и подсказывает запрещённый заказ', () => {
    let room = started();
    for (const uid of ['u1', 'u2', 'u3']) {
      room = applyPatch(room, bidPatch(room, { actorUid: uid, targetUid: uid, value: 0 }));
    }
    const view = selectRoomView(room, 'u0')!;
    expect(view.game!.activeBidder).toBe('u0');
    expect(view.game!.isMyTurn).toBe(true);
    expect(view.game!.bidContext!.forbidden).toBe(1);
    expect(view.game!.roundLabel).toBe('1');
  });

  it('вью отдаёт раздающего и первого заказывающего', () => {
    const view = selectRoomView(started(), 'u0')!;
    expect(view.game!.dealer).toBe('u0');
    expect(view.game!.firstBidder).toBe('u1');
  });

  it('во втором раунде раздаёт второй игрок', () => {
    const room = playFullGame(4);
    expect(biddingOrder(room.game!.playerOrder, 1)).toEqual(['u2', 'u3', 'u0', 'u1']);
  });

  it('битый playerOrder не роняет вью', () => {
    const room = { ...makeRoom(4), game: { playerOrder: [] } } as unknown as Room;
    expect(selectRoomView(room, 'u0')!.game).toBe(null);
  });
});

describe('партии стола', () => {
  it('нумерация партий продолжает архив', () => {
    expect(nextGameNumber(makeRoom(4))).toBe(1);
    expect(nextGameNumber({ ...makeRoom(4), games: [{}, {}] as never })).toBe(3);
  });

  it('доигранная партия уходит в архив со сводкой, состав остаётся', () => {
    const played = playFullGame(4);
    const room = applyPatch(played, archiveGamePatch(played, 'u0'));

    expect(room.status).toBe(ROOM_STATUS.WAITING);
    expect(room.game).toBe(null);
    expect(room.history).toHaveLength(0);
    expect(room.players).toHaveLength(4);

    const [archived] = room.games!;
    expect(archived.number).toBe(1);
    expect(archived.rounds).toBe(36);
    expect(archived.playerOrder).toEqual(['u0', 'u1', 'u2', 'u3']);
    expect(archived.results.map((r) => r.place)).toEqual([1, 2, 3, 4]);
    // Сводка совпадает с итогами, которые видел игрок на финале.
    expect(archived.results.map((r) => r.total)).toEqual(
      selectRoomView(played, 'u0')!.standings.map((p) => p.total),
    );
  });

  it('недоигранную партию в архив не пускает', () => {
    const room = started();
    expect(() => archiveGamePatch(room, 'u0')).toThrow(/ещё не доиграна/);
  });

  it('архивировать может только хост', () => {
    const played = playFullGame(4);
    expect(() => archiveGamePatch(played, 'u1')).toThrow(/хост/);
  });

  it('новую партию поверх доигранной начать нельзя — сначала архив', () => {
    const played = playFullGame(4);
    expect(() => startGamePatch(played, 'u0')).toThrow(/закройте прошлую партию/);
  });

  it('после архива номер следующей партии растёт, а сброс архив не трогает', () => {
    const played = playFullGame(4);
    let room = applyPatch(played, archiveGamePatch(played, 'u0'));
    expect(nextGameNumber(room)).toBe(2);

    room = applyPatch(room, startGamePatch(room, 'u0'));
    room = applyPatch(room, resetGamePatch(room, 'u0'));
    expect(room.games).toHaveLength(1);
    expect(nextGameNumber(room)).toBe(2);
  });
});
