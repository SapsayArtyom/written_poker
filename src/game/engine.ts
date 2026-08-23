import { GAME_PHASE, ROOM_STATUS } from './constants.js';
import {
  biddingOrder,
  buildRoundPlan,
  currentBidderUid,
  isPlayerCountAllowed,
} from './rounds.js';
import { DEFAULT_RULES, computeTotals, scoreRound, standings } from './scoring.js';
import { validateBid, validateTricks } from './validation.js';
import type {
  FinishedGame,
  HistoryEntry,
  Room,
  RoomPatch,
  Round,
  Rules,
  Tricks,
  Uid,
} from '../types.js';

/**
 * Чистый движок игры: принимает документ комнаты, возвращает набор полей для записи.
 * Никакой зависимости от Firestore — за счёт этого весь ход игры покрывается тестами,
 * а бэкенды только оборачивают результат в запись.
 *
 * Каждая функция бросает Error с текстом для пользователя, если ход невозможен.
 */

/**
 * Ходить вправе игрок за столом или хост.
 * В режиме «один ведёт стол» админ сам может не играть — стол он всё равно ведёт.
 */
function assertActor(room: Room, uid: Uid): void {
  const isPlayer = (room.players ?? []).some((p) => p.uid === uid);
  if (!isPlayer && room.hostId !== uid) throw new Error('Вы не за этим столом');
}

function assertHost(room: Room, uid: Uid, action: string): void {
  if (room.hostId !== uid) throw new Error(`${action} может только хост`);
}

function requireGame(room: Room) {
  if (!room.game) throw new Error('Игра не начата');
  return room.game;
}

/** Сетка раундов комнаты: по составу игры, а до старта — по составу стола. */
export function planFor(room: Room): Round[] {
  return buildRoundPlan((room.game?.playerOrder ?? room.players ?? []).length);
}

export function currentRound(room: Room): Round {
  const game = requireGame(room);
  return planFor(room)[game.roundIndex];
}

/** Вход в раунд: в мизерах заказа нет, поэтому сразу фаза подсчёта взяток. */
function enterRound(round: Round) {
  return {
    roundIndex: round.index,
    phase: round.hasBidding ? GAME_PHASE.BIDDING : GAME_PHASE.RESULTS,
    bids: {},
    tricks: {},
  };
}

/** Номер следующей партии: продолжаем нумерацию архива. */
export function nextGameNumber(room: Room): number {
  return (room.games?.length ?? 0) + 1;
}

export function startGamePatch(room: Room, uid: Uid): RoomPatch {
  assertHost(room, uid, 'Начать партию');
  if (room.status === ROOM_STATUS.PLAYING) throw new Error('Партия уже идёт');
  if (room.status === ROOM_STATUS.FINISHED) {
    throw new Error('Сначала закройте прошлую партию — она уйдёт в архив стола');
  }

  const players = room.players ?? [];
  if (!isPlayerCountAllowed(players.length)) {
    throw new Error('Нужно чётное число игроков: 2, 4 или 6 — иначе колода не раздастся полностью');
  }

  const plan = buildRoundPlan(players.length);

  return {
    status: ROOM_STATUS.PLAYING,
    history: [],
    game: {
      playerOrder: players.map((p) => p.uid),
      ...enterRound(plan[0]),
      startedAt: Date.now(),
      finishedAt: null,
    },
  };
}

export interface BidInput {
  actorUid: Uid;
  targetUid: Uid;
  value: number;
}

/**
 * Заказ взяток. Заказывает либо сам игрок, чья очередь, либо хост —
 * удобно, когда все сидят за одним столом и пишут с одного телефона.
 */
export function bidPatch(room: Room, { actorUid, targetUid, value }: BidInput): RoomPatch {
  const game = requireGame(room);
  if (game.phase !== GAME_PHASE.BIDDING) throw new Error('Сейчас не фаза заказа');
  assertActor(room, actorUid);

  const round = planFor(room)[game.roundIndex];
  if (!round.hasBidding) throw new Error('В мизерах заказа нет');

  const expected = currentBidderUid(game.playerOrder, game.roundIndex, game.bids);
  if (expected === null) throw new Error('Все заказы в этом раунде уже сделаны');
  if (targetUid !== expected) throw new Error('Сейчас заказывает другой игрок');
  if (actorUid !== expected && room.hostId !== actorUid) {
    throw new Error('Сейчас не ваша очередь заказывать');
  }

  const check = validateBid({
    playerOrder: game.playerOrder,
    roundIndex: game.roundIndex,
    cards: round.cards,
    bids: game.bids,
    uid: targetUid,
    value,
  });
  if (!check.ok) throw new Error(check.error);

  const bids = { ...game.bids, [targetUid]: value };
  const everyoneBid = currentBidderUid(game.playerOrder, game.roundIndex, bids) === null;

  return {
    'game.bids': bids,
    'game.phase': everyoneBid ? GAME_PHASE.RESULTS : GAME_PHASE.BIDDING,
  };
}

/** Отмена последнего заказа в текущем раунде — если ошиблись при вводе. */
export function undoBidPatch(room: Room, actorUid: Uid): RoomPatch {
  const game = requireGame(room);
  assertHost(room, actorUid, 'Отменять заказ');
  if (game.phase === GAME_PHASE.FINISHED) throw new Error('Игра завершена');

  const round = planFor(room)[game.roundIndex];
  if (!round.hasBidding) throw new Error('В мизерах заказа нет');

  const order = biddingOrder(game.playerOrder, game.roundIndex);
  const made = order.filter((uid) => game.bids?.[uid] !== undefined);
  if (made.length === 0) throw new Error('В этом раунде заказов ещё нет');

  const bids = { ...game.bids };
  delete bids[made[made.length - 1]];

  return { 'game.bids': bids, 'game.phase': GAME_PHASE.BIDDING };
}

/** Итоги раунда: кто сколько взял. Считаем очки, пишем в историю, идём дальше. */
export function closeRoundPatch(
  room: Room,
  { actorUid, tricks }: { actorUid: Uid; tricks: Tricks },
): RoomPatch {
  const game = requireGame(room);
  if (game.phase !== GAME_PHASE.RESULTS) throw new Error('Сейчас не фаза подсчёта взяток');
  assertActor(room, actorUid);

  const plan = planFor(room);
  const round = plan[game.roundIndex];

  const check = validateTricks({ cards: round.cards, playerOrder: game.playerOrder, tricks });
  if (!check.ok) throw new Error(check.error);

  const rules: Rules = { ...DEFAULT_RULES, ...(room.rules ?? {}) };
  const scores = scoreRound({
    round,
    playerOrder: game.playerOrder,
    bids: game.bids,
    tricks,
    rules,
  });

  const entry: HistoryEntry = {
    roundIndex: game.roundIndex,
    number: round.number,
    cards: round.cards,
    kind: round.kind,
    bids: game.bids,
    tricks,
    scores,
    closedAt: Date.now(),
    closedBy: actorUid,
  };

  const nextIndex = game.roundIndex + 1;
  const isOver = nextIndex >= plan.length;

  return {
    history: [...(room.history ?? []), entry],
    status: isOver ? ROOM_STATUS.FINISHED : ROOM_STATUS.PLAYING,
    game: {
      ...game,
      ...(isOver
        ? { phase: GAME_PHASE.FINISHED, bids: {}, tricks: {} }
        : enterRound(plan[nextIndex])),
      finishedAt: isOver ? Date.now() : null,
    },
  };
}

/** Откатить последний закрытый раунд — вернуться к вводу его взяток. */
export function undoRoundPatch(room: Room, actorUid: Uid): RoomPatch {
  assertHost(room, actorUid, 'Откатить раунд');

  const history = [...(room.history ?? [])];
  const last = history.pop();
  if (!last) throw new Error('Закрытых раундов ещё нет');

  return {
    history,
    status: ROOM_STATUS.PLAYING,
    game: {
      ...room.game,
      roundIndex: last.roundIndex,
      phase: GAME_PHASE.RESULTS,
      bids: last.bids,
      tricks: {},
      finishedAt: null,
    },
  };
}

/** Сброс партии: стол возвращается в ожидание, состав игроков сохраняется. */
export function resetGamePatch(room: Room, actorUid: Uid): RoomPatch {
  assertHost(room, actorUid, 'Сбросить партию');
  return { status: ROOM_STATUS.WAITING, game: null, history: [] };
}

/**
 * Закрыть доигранную партию: сводка уходит в архив стола, состав остаётся.
 * После этого можно поменять очерёдность и начать следующую.
 */
export function archiveGamePatch(room: Room, actorUid: Uid): RoomPatch {
  assertHost(room, actorUid, 'Закрыть партию');

  const game = requireGame(room);
  if (room.status !== ROOM_STATUS.FINISHED || game.phase !== GAME_PHASE.FINISHED) {
    throw new Error('Партия ещё не доиграна');
  }

  const history = room.history ?? [];
  const playersByUid = Object.fromEntries((room.players ?? []).map((p) => [p.uid, p]));
  const orderedPlayers = game.playerOrder
    .map((uid) => playersByUid[uid])
    .filter((p) => Boolean(p));

  const finished: FinishedGame = {
    number: nextGameNumber(room),
    startedAt: game.startedAt,
    finishedAt: game.finishedAt ?? Date.now(),
    rounds: history.length,
    playerOrder: game.playerOrder,
    results: standings(computeTotals(history, game.playerOrder), orderedPlayers).map((p) => ({
      uid: p.uid,
      name: p.name,
      total: p.total,
      place: p.place,
    })),
  };

  return {
    games: [...(room.games ?? []), finished],
    status: ROOM_STATUS.WAITING,
    game: null,
    history: [],
  };
}

/**
 * Применяет патч движка к обычному объекту комнаты.
 * Firestore сам понимает точечные пути вида `game.bids`, здесь разворачиваем
 * их руками — нужно для локального бэкенда и тестов.
 */
export function applyPatch(room: Room, patch: RoomPatch): Room {
  const next: Room = { ...room, game: room.game ? { ...room.game } : room.game };
  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith('game.')) {
      if (!next.game) throw new Error('Нельзя менять игру, которая не начата');
      (next.game as unknown as Record<string, unknown>)[key.slice(5)] = value;
    } else {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}
