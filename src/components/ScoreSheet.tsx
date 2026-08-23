import { useState } from 'react';
import { ROUND_KIND_META } from '../game/constants.js';
import { dealerUid, roundLabel } from '../game/rounds.js';
import Points from './Points.js';
import type { RoomView } from '../game/view.js';

/** Ширины колонок в пикселях — расписка на 6 игроков всё равно шире телефона. */
const ROUND_COL = 84;
const CELL_COL = 46;

/** Первая буква имени — метка раздающего в строке раунда. */
function initial(name: string | undefined): string {
  return name?.trim().charAt(0).toUpperCase() ?? '?';
}

/**
 * Расписка: строка на раунд, на каждого игрока «заказ/взял» и накопленная сумма.
 * Колонки игроков одинаковой ширины, имена при нехватке места обрезаются.
 * Первый столбец липкий — при горизонтальной прокрутке видно, какой это раунд
 * и кто его раздавал.
 */
export default function ScoreSheet({ view }: { view: RoomView }) {
  const { plan, game, history, runningTotals, totals } = view;
  const [showTotals, setShowTotals] = useState(false);

  if (!game) return null;

  const players = game.orderedPlayers;
  const playedByIndex = new Map(history.map((entry, i) => [entry.roundIndex, { entry, i }]));

  return (
    <section className="card stack stack--tight">
      <div className="row">
        <span className="card__title">Расписка</span>
        <span className="spacer" />
        <span className="faint">
          {history.length} из {plan.length} раундов
        </span>
      </div>

      <div className="sheet-wrap">
        <table className="sheet">
          <colgroup>
            <col style={{ width: ROUND_COL }} />
            {players.flatMap((p) => [
              <col key={`${p.uid}-bt`} style={{ width: CELL_COL }} />,
              <col key={`${p.uid}-sum`} style={{ width: CELL_COL }} />,
            ])}
          </colgroup>

          <thead>
            <tr>
              <th className="rc" rowSpan={2}>
                Раунд
              </th>
              {players.map((p) => (
                <th key={p.uid} colSpan={2}>
                  <span className="truncate" style={{ display: 'block' }} title={p.name}>
                    {p.name}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {players.flatMap((p) => [
                <th key={`${p.uid}-bt`} style={{ fontWeight: 400 }}>
                  з/в
                </th>,
                <th key={`${p.uid}-sum`} style={{ fontWeight: 400 }}>
                  Σ
                </th>,
              ])}
            </tr>
          </thead>

          <tbody>
            {plan.map((round) => {
              const played = playedByIndex.get(round.index);
              const isCurrent = !played && round.index === game.roundIndex;
              const meta = ROUND_KIND_META[round.kind];
              const dealer = view.playersByUid[dealerUid(game.playerOrder, round.index)];

              return (
                <tr key={round.index} className={isCurrent ? 'is-current' : undefined}>
                  <td className="rc" title={`Раздаёт ${dealer?.name ?? '—'}`}>
                    <span className="zero">{round.number}.</span>{' '}
                    <span style={{ color: meta.code ? meta.color : undefined }}>
                      {roundLabel(round)}
                    </span>{' '}
                    <span className="rc__dealer">{initial(dealer?.name)}</span>
                  </td>

                  {players.flatMap((p) => {
                    if (played) {
                      const { entry, i } = played;
                      const taken = entry.tricks?.[p.uid] ?? 0;
                      const bid = entry.bids?.[p.uid];
                      const score = entry.scores?.[p.uid] ?? 0;
                      return [
                        <td key={`${p.uid}-bt`} title={`Очки за раунд: ${score}`}>
                          <span className={score < 0 ? 'neg' : undefined}>
                            {bid === undefined ? taken : `${bid}/${taken}`}
                          </span>
                        </td>,
                        <td key={`${p.uid}-sum`} className="sum">
                          <Points
                            value={runningTotals[i]?.[p.uid] ?? 0}
                            showPlus={false}
                            className=""
                          />
                        </td>,
                      ];
                    }

                    if (isCurrent) {
                      const bid = game.bids[p.uid];
                      return [
                        <td key={`${p.uid}-bt`}>
                          {bid === undefined ? <span className="zero">·</span> : `${bid}/?`}
                        </td>,
                        <td key={`${p.uid}-sum`} className="zero">
                          ·
                        </td>,
                      ];
                    }

                    return [
                      <td key={`${p.uid}-bt`} className="zero">
                        ·
                      </td>,
                      <td key={`${p.uid}-sum`} className="zero">
                        ·
                      </td>,
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr>
              <td className="rc">Итого</td>
              {players.flatMap((p) => [
                <td key={`${p.uid}-bt`} className="zero">
                  ·
                </td>,
                <td key={`${p.uid}-sum`}>
                  {showTotals ? (
                    <Points value={totals[p.uid] ?? 0} showPlus={false} className="" />
                  ) : (
                    <span className="zero" aria-hidden>
                      •••
                    </span>
                  )}
                </td>,
              ])}
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        className="btn btn--sm"
        style={{ alignSelf: 'flex-start' }}
        aria-pressed={showTotals}
        onClick={() => setShowTotals((v) => !v)}
      >
        {showTotals ? 'Скрыть итог' : 'Показать итог'}
      </button>
    </section>
  );
}
