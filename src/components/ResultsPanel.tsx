import { useMemo, useState } from 'react';
import { ROUND_KIND } from '../game/constants.js';
import { scorePlayerRound } from '../game/scoring.js';
import ConfirmDialog from './ConfirmDialog.js';
import Points from './Points.js';
import type { RoomView } from '../game/view.js';
import type { Tricks, Uid } from '../types.js';

/** Фаза «кто сколько взял». Сумма взяток обязана совпасть с числом карт. */
export default function ResultsPanel({
  view,
  myUid,
  busy,
  onClose,
  onUndoRound,
}: {
  view: RoomView;
  myUid: Uid;
  busy: boolean;
  onClose: (tricks: Tricks) => void;
  onUndoRound: () => void;
}) {
  const { game, playersByUid, rules, isHost, history, canControl } = view;
  const order = game?.order ?? [];
  const [tricks, setTricks] = useState<Tricks>(() =>
    Object.fromEntries(order.map((uid) => [uid, 0])),
  );
  const [confirmBack, setConfirmBack] = useState(false);

  const sum = useMemo(
    () => order.reduce((acc, uid) => acc + (tricks[uid] ?? 0), 0),
    [order, tricks],
  );

  if (!game) return null;
  const { round, bids } = game;
  const left = round.cards - sum;
  const valid = left === 0;
  const isMisere = round.kind === ROUND_KIND.MISERE;

  const set = (uid: Uid, value: number): void => {
    setTricks((prev) => ({ ...prev, [uid]: Math.max(0, Math.min(round.cards, value)) }));
  };

  if (!canControl) {
    return (
      <section className="card stack stack--tight">
        <div className="banner banner--info">
          Взятки за этот раунд вводит админ стола.
        </div>
        {order.map((uid) => (
          <div key={uid} className="prow">
            <span className="prow__name">
              {playersByUid[uid]?.name ?? 'Игрок'}
              {!isMisere && bids[uid] !== undefined && (
                <span className="prow__sub"> · {bids[uid] === 0 ? 'пас' : `заказ ${bids[uid]}`}</span>
              )}
            </span>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="stack">
      {isMisere && (
        <div className="banner banner--warn">
          Мизера: заказа нет. Кто не взял ни одной взятки — плюс{' '}
          {rules.passValue * game.roundMeta.multiplier}, каждая взятка —{' '}
          −{rules.misereTrickPenalty * game.roundMeta.multiplier}.
        </div>
      )}

      <div className="card stack stack--tight">
        <div className="row">
          <span className="card__title">Кто сколько взял</span>
          <span className="spacer" />
          <span className="faint">
            {sum} из {round.cards}
          </span>
        </div>

        {order.map((uid) => {
          const player = playersByUid[uid];
          const bid = bids[uid];
          const taken = tricks[uid] ?? 0;
          const preview = scorePlayerRound({ bid: bid ?? 0, taken, kind: round.kind, rules });

          return (
            <div key={uid} className={`prow${uid === myUid ? ' prow--me' : ''}`}>
              <span className="prow__name">
                {player?.name ?? 'Игрок'}
                {!isMisere && bid !== undefined && (
                  <span className="prow__sub"> · {bid === 0 ? 'пас' : `заказ ${bid}`}</span>
                )}
              </span>

              <div className="stepper">
                <button
                  type="button"
                  className="stepper__btn"
                  disabled={busy || taken === 0}
                  onClick={() => set(uid, taken - 1)}
                  aria-label={`Меньше взяток у ${player?.name ?? 'игрока'}`}
                >
                  −
                </button>
                <span className="stepper__value">{taken}</span>
                <button
                  type="button"
                  className="stepper__btn"
                  disabled={busy || taken >= round.cards}
                  onClick={() => set(uid, taken + 1)}
                  aria-label={`Больше взяток у ${player?.name ?? 'игрока'}`}
                >
                  +
                </button>
              </div>

              <Points value={preview} />
            </div>
          );
        })}
      </div>

      <div className={`banner banner--${valid ? 'good' : 'warn'}`}>
        {valid
          ? `Все ${round.cards} взяток распределены`
          : left > 0
            ? `Осталось распределить взяток: ${left}`
            : `Лишних взяток: ${-left}`}
      </div>

      <ConfirmDialog
        open={confirmBack}
        danger
        busy={busy}
        title="Вернуться к прошлому раунду?"
        text={`Введённые сейчас взятки будут стёрты, а раунд ${history.at(-1)?.number ?? ''} снова откроется на вводе взяток. Его очки пересчитаются заново.`}
        confirmLabel="Вернуться назад"
        cancelLabel="Остаться"
        onCancel={() => setConfirmBack(false)}
        onConfirm={() => {
          setConfirmBack(false);
          onUndoRound();
        }}
      />

      <div className="actionbar">
        {isHost && history.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => setConfirmBack(true)}
            title="Вернуться к предыдущему раунду"
          >
            Назад
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={!valid || busy}
          onClick={() => onClose(tricks)}
        >
          {valid ? 'Закрыть раунд' : `Ещё ${Math.abs(left)}`}
        </button>
      </div>
    </section>
  );
}
