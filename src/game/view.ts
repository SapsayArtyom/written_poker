import {
  GAME_PHASE,
  ROOM_MODE,
  ROOM_STATUS,
  ROUND_KIND_META,
  type RoundKindMeta,
} from './constants.js';
import {
  biddingOrder,
  buildRoundPlan,
  currentBidderUid,
  dealerUid,
  isPlayerCountAllowed,
  roundLabel,
} from './rounds.js';
import {
  DEFAULT_RULES,
  computeRunningTotals,
  computeTotals,
  standings,
  type Standing,
} from './scoring.js';
import { bidContext } from './validation.js';
import type {
  BidContext,
  Bids,
  FinishedGame,
  GamePhase,
  HistoryEntry,
  Player,
  Room,
  RoomMode,
  RoomStatus,
  Round,
  Rules,
  Scores,
  Uid,
} from '../types.js';

export interface GameView {
  playerOrder: Uid[];
  orderedPlayers: Player[];
  roundIndex: number;
  phase: GamePhase;
  bids: Bids;
  bidsSum: number;
  round: Round;
  roundMeta: RoundKindMeta;
  roundLabel: string;
  roundsTotal: number;
  /** Порядок хода в этом раунде. */
  order: Uid[];
  /** Кто раздаёт этот раунд. */
  dealer: Uid;
  /** Кто заказывает первым — следующий за раздающим. */
  firstBidder: Uid;
  activeBidder: Uid | null;
  isMyTurn: boolean;
  bidContext: BidContext | null;
  isFinished: boolean;
}

export interface RoomView {
  id: string;
  name: string;
  mode: RoomMode;
  /** Режим «один ведёт стол»: игроков добавляет админ, он же вводит всё за них. */
  isSingleDevice: boolean;
  status: RoomStatus;
  hostId: Uid | null;
  players: Player[];
  playersByUid: Record<Uid, Player>;
  /** Хост комнаты; в режиме single это админ стола. */
  isHost: boolean;
  amAtTable: boolean;
  /** Можно ли вообще что-то менять: в single — только админу. */
  canControl: boolean;
  rules: Rules;
  history: HistoryEntry[];
  game: GameView | null;
  plan: Round[];
  totals: Scores;
  runningTotals: Scores[];
  standings: Standing[];
  /** Завершённые партии этого стола, от старых к новым. */
  games: FinishedGame[];
  /** Номер партии, которая начнётся следующей. */
  nextGameNumber: number;
}

/**
 * Разворачивает документ комнаты в готовое для рендера состояние.
 * Ничего не знает про React и Firebase — только чистая производная от снапшота.
 */
export function selectRoomView(room: Room | null, myUid: Uid | undefined): RoomView | null {
  if (!room) return null;

  const players = room.players ?? [];
  const playersByUid = Object.fromEntries(players.map((p) => [p.uid, p]));
  const rules: Rules = { ...DEFAULT_RULES, ...(room.rules ?? {}) };
  const history = room.history ?? [];

  const mode: RoomMode = room.mode ?? ROOM_MODE.ONLINE;
  const isHost = Boolean(myUid) && room.hostId === myUid;
  const isSingleDevice = mode === ROOM_MODE.SINGLE;
  const games = room.games ?? [];

  const base = {
    id: room.id,
    name: room.name,
    mode,
    isSingleDevice,
    status: room.status ?? ROOM_STATUS.WAITING,
    hostId: room.hostId ?? null,
    players,
    playersByUid,
    isHost,
    amAtTable: players.some((p) => p.uid === myUid),
    canControl: isSingleDevice ? isHost : true,
    rules,
    history,
    games,
    nextGameNumber: games.length + 1,
  };

  const game = room.game;
  // Пустой или битый playerOrder дал бы buildRoundPlan(0) с бесконечным
  // максимумом карт — считаем такую комнату просто не начавшей игру.
  if (!game || !isPlayerCountAllowed(game.playerOrder?.length ?? 0)) {
    return { ...base, game: null, plan: [], totals: {}, runningTotals: [], standings: [] };
  }

  const playerOrder = game.playerOrder;
  const orderedPlayers = playerOrder
    .map((uid) => playersByUid[uid])
    .filter((p): p is Player => Boolean(p));

  const plan = buildRoundPlan(playerOrder.length);
  const roundIndex = Math.min(game.roundIndex ?? 0, plan.length - 1);
  const round = plan[roundIndex];
  const phase = game.phase ?? GAME_PHASE.BIDDING;

  const bids = game.bids ?? {};
  const bidsSum = playerOrder.reduce((acc, uid) => acc + (bids[uid] ?? 0), 0);

  // В мизерах заказа нет — активного заказывающего тоже.
  const activeBidder = round.hasBidding
    ? currentBidderUid(playerOrder, roundIndex, bids)
    : null;

  const totals = computeTotals(history, playerOrder);

  return {
    ...base,
    game: {
      playerOrder,
      orderedPlayers,
      roundIndex,
      phase,
      bids,
      bidsSum,
      round,
      roundMeta: ROUND_KIND_META[round.kind],
      roundLabel: roundLabel(round),
      roundsTotal: plan.length,
      order: biddingOrder(playerOrder, roundIndex),
      dealer: dealerUid(playerOrder, roundIndex),
      firstBidder: biddingOrder(playerOrder, roundIndex)[0],
      activeBidder,
      isMyTurn: activeBidder !== null && activeBidder === myUid,
      bidContext: activeBidder
        ? bidContext({ playerOrder, roundIndex, cards: round.cards, bids, uid: activeBidder })
        : null,
      isFinished: phase === GAME_PHASE.FINISHED,
    },
    plan,
    totals,
    runningTotals: computeRunningTotals(history, playerOrder),
    standings: standings(totals, orderedPlayers),
  };
}
