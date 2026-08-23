import { ROUND_KIND, ROUND_KIND_META } from './constants.js';
import type { HistoryEntry, Player, Round, RoundKind, Rules, Scores, Uid } from '../types.js';

/**
 * Правила подсчёта очков.
 *
 * Обычный раунд (множитель 1), Б/Т/М — x2, З — x5:
 *   заказал N, взял ровно N   -> N * 10 * множитель
 *   пас (0) и не взял         -> 5 * множитель
 *   недобор                   -> -10 * (заказ - взято) * множитель
 *   перебор                   -> заказ оплачен + 1 очко за каждую лишнюю взятку
 *   пас, но взял взятки       -> +1 очко за каждую взятку (пас не оплачивается)
 *
 * Мизера — особый раунд: заказа нет, все играют на минимум взяток.
 *   не взял ни одной          -> 5 * множитель (то есть 10)
 *   взял N                    -> -10 * N * множитель (то есть -20 за взятку)
 */
export const DEFAULT_RULES: Rules = {
  trickValue: 10,
  passValue: 5,
  undertrickValue: 10,
  extraTrickValue: 1,
  multiplyExtras: false,
  misereTrickPenalty: 10,
};

export function roundMultiplier(kind: RoundKind): number {
  return ROUND_KIND_META[kind]?.multiplier ?? 1;
}

export interface ScoreInput {
  bid: number;
  taken: number;
  kind: RoundKind;
  rules?: Partial<Rules>;
}

/** Очки одного игрока за один раунд. */
export function scorePlayerRound({ bid, taken, kind, rules }: ScoreInput): number {
  const r: Rules = { ...DEFAULT_RULES, ...rules };
  const m = roundMultiplier(kind);
  const extraValue = r.extraTrickValue * (r.multiplyExtras ? m : 1);

  // Мизера: заказа нет, каждая взятка — штраф.
  if (kind === ROUND_KIND.MISERE) {
    return taken === 0 ? r.passValue * m : -r.misereTrickPenalty * taken * m;
  }

  if (bid === 0) {
    // Пас. Удержал — очки за пас; не удержал — только по очку за взятку.
    return taken === 0 ? r.passValue * m : taken * extraValue;
  }

  if (taken === bid) return bid * r.trickValue * m;
  if (taken < bid) return -(bid - taken) * r.undertrickValue * m;

  // Перебор: заказ оплачен, лишние взятки идут дешёвыми очками.
  return bid * r.trickValue * m + (taken - bid) * extraValue;
}

export interface RoundScoreInput {
  round: Pick<Round, 'kind'>;
  playerOrder: Uid[];
  bids?: Record<Uid, number>;
  tricks?: Record<Uid, number>;
  rules?: Partial<Rules>;
}

/** Очки всех игроков за раунд. */
export function scoreRound({
  round,
  playerOrder,
  bids,
  tricks,
  rules,
}: RoundScoreInput): Scores {
  const scores: Scores = {};
  for (const uid of playerOrder) {
    scores[uid] = scorePlayerRound({
      bid: bids?.[uid] ?? 0,
      taken: tricks?.[uid] ?? 0,
      kind: round.kind,
      rules,
    });
  }
  return scores;
}

/** Итоговые суммы по всей истории раундов. */
export function computeTotals(history: HistoryEntry[] = [], playerOrder: Uid[] = []): Scores {
  const totals: Scores = {};
  for (const uid of playerOrder) totals[uid] = 0;
  for (const entry of history) {
    for (const uid of playerOrder) totals[uid] += entry.scores?.[uid] ?? 0;
  }
  return totals;
}

/** Промежуточные суммы после каждого раунда — для таблицы-расписки. */
export function computeRunningTotals(
  history: HistoryEntry[] = [],
  playerOrder: Uid[] = [],
): Scores[] {
  const running: Scores = {};
  for (const uid of playerOrder) running[uid] = 0;
  return history.map((entry) => {
    for (const uid of playerOrder) running[uid] += entry.scores?.[uid] ?? 0;
    return { ...running };
  });
}

export interface Standing extends Player {
  total: number;
  place: number;
}

/** Места по убыванию очков; равные суммы делят место. */
export function standings(totals: Scores, players: Player[]): Standing[] {
  const sorted = [...players]
    .map((p) => ({ ...p, total: totals[p.uid] ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const result: Standing[] = [];
  sorted.forEach((p, i) => {
    const previous = result[i - 1];
    result.push({ ...p, place: previous && previous.total === p.total ? previous.place : i + 1 });
  });
  return result;
}
