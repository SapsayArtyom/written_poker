import { useState } from 'react';
import { ALLOWED_PLAYER_COUNTS, ROUND_KIND, ROUND_KIND_META } from '../game/constants.js';
import { buildRoundPlan, maxCardsPerPlayer, roundLabel } from '../game/rounds.js';
import type { Rules } from '../types.js';

/** Справка: как считаются очки и как выглядит сетка раундов для текущего состава. */
export default function RulesInfo({
  playerCount,
  rules,
}: {
  playerCount: number;
  rules: Rules;
}) {
  const [open, setOpen] = useState(false);
  const valid = (ALLOWED_PLAYER_COUNTS as readonly number[]).includes(playerCount);
  const plan = valid ? buildRoundPlan(playerCount) : [];

  return (
    <section className="card stack stack--tight">
      <div className="row">
        <span className="card__title">Правила и сетка</span>
        <span className="spacer" />
        <button type="button" className="linkbtn" onClick={() => setOpen((v) => !v)}>
          {open ? 'свернуть' : 'подробнее'}
        </button>
      </div>

      <ul className="rules">
        <li>
          Заказал N взяток и взял ровно N → <b>N × {rules.trickValue}</b>
        </li>
        <li>
          Пас и не взял ни одной → <b>{rules.passValue}</b>
        </li>
        <li>
          Недобор → <b>−{rules.undertrickValue}</b> за каждую невзятую
        </li>
        <li>
          Перебор и взятки при пасе → <b>+{rules.extraTrickValue}</b> за взятку
        </li>
        <li>
          Б и Т → <b>×2</b>, З (золотые) → <b>×5</b>
        </li>
        <li>
          М (мизера) → заказа нет: не взял → <b>{rules.passValue * 2}</b>, каждая взятка →{' '}
          <b>−{rules.misereTrickPenalty * 2}</b>
        </li>
        <li>Сумма заказов не может быть равна числу розданных карт</li>
      </ul>

      {open && (
        <>
          <div className="stack stack--tight">
            <span className="card__title">Спецсерии</span>
            <ul className="rules">
              {(['noTrump', 'dark', 'misere', 'gold'] as const).map((kind) => {
                const meta = ROUND_KIND_META[kind];
                return (
                  <li key={kind}>
                    <b style={{ color: meta.color }}>
                      {meta.code} — {meta.label}
                    </b>
                    : {meta.hint}
                  </li>
                );
              })}
            </ul>
          </div>

          {valid ? (
            <div className="stack stack--tight">
              <span className="card__title">
                Сетка на {playerCount} игроков — {plan.length} раундов, максимум{' '}
                {maxCardsPerPlayer(playerCount)} карт
              </span>
              <div className="roundmap">
                {plan.map((r) => (
                  <span
                    key={r.index}
                    className="chip"
                    style={{
                      color: r.kind === ROUND_KIND.TRUMP ? undefined : ROUND_KIND_META[r.kind].color,
                    }}
                    title={`Раунд ${r.number}: ${ROUND_KIND_META[r.kind].label}`}
                  >
                    {roundLabel(r)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="faint">Сетка появится, когда за столом будет 2, 4 или 6 игроков.</p>
          )}
        </>
      )}
    </section>
  );
}
