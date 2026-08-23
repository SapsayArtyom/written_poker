import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog.js';
import type { RoomView } from '../game/view.js';
import type { Uid } from '../types.js';

/**
 * Фаза заказа.
 *
 * В обычном режиме заказывает игрок, чья очередь (хост может ввести за него).
 * В режиме «один ведёт стол» всё вводит админ, поэтому заказ фиксируется сразу
 * по нажатию цифры — за партию это экономит больше сотни нажатий, а ошибка
 * отменяется кнопкой «Отменить».
 */
export default function BiddingPanel({
  view,
  myUid,
  busy,
  onBid,
  onUndoBid,
}: {
  view: RoomView;
  myUid: Uid;
  busy: boolean;
  onBid: (input: { targetUid: Uid; value: number }) => Promise<boolean>;
  onUndoBid: () => void;
}) {
  const { game, playersByUid, isHost, isSingleDevice } = view;
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);

  if (!game) return null;
  const { order, bids, activeBidder, bidContext, round } = game;

  const active = activeBidder ? playersByUid[activeBidder] : null;
  const iAmActive = activeBidder !== null && activeBidder === myUid;
  const canBid = Boolean(bidContext) && (isSingleDevice ? isHost : iAmActive || isHost);
  const madeCount = order.filter((uid) => bids[uid] !== undefined).length;
  const lastBidder = order.filter((uid) => bids[uid] !== undefined).at(-1);
  const lastBidderName = lastBidder ? playersByUid[lastBidder]?.name : undefined;

  const submit = async (value: number): Promise<void> => {
    if (!activeBidder) return;
    const ok = await onBid({ targetUid: activeBidder, value });
    if (ok) setSelected(null);
  };

  const title = isSingleDevice
    ? `Заказ: ${active?.name ?? 'игрок'}`
    : iAmActive
      ? 'Ваш заказ'
      : `Заказ за ${active?.name ?? 'игрока'} — вы хост`;

  return (
    <section className="stack">
      <div className="card stack stack--tight">
        <div className="row">
          <span className="card__title">Заказы</span>
          <span className="spacer" />
          <span className="faint">
            {madeCount} из {order.length}
          </span>
        </div>

        {order.map((uid, i) => {
          const player = playersByUid[uid];
          const bid = bids[uid];
          const isActive = uid === activeBidder;
          return (
            <div
              key={uid}
              className={[
                'prow',
                isActive ? 'prow--active' : '',
                !isSingleDevice && uid === myUid ? 'prow--me' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="prow__seat">{i + 1}</span>
              {player?.photoURL && <img className="avatar" src={player.photoURL} alt="" />}
              <span className="prow__name">{player?.name ?? 'Игрок'}</span>
              {bid !== undefined ? (
                <span className="chip chip--bid">{bid === 0 ? 'пас' : bid}</span>
              ) : (
                <span className="prow__sub">{isActive ? 'заказывает' : 'ждёт'}</span>
              )}
            </div>
          );
        })}
      </div>

      {canBid && bidContext ? (
        <div className="card stack stack--tight">
          <div className="label" style={{ margin: 0 }}>
            {title}
          </div>

          {bidContext.forbidden !== null && (
            <div className="banner banner--warn">
              Нельзя заказать {bidContext.forbidden}: сумма заказов станет равна {round.cards}
            </div>
          )}

          <div className="bidgrid">
            {bidContext.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`bidbtn${opt.value === 0 ? ' bidbtn--pass' : ''}`}
                aria-pressed={!isSingleDevice && selected === opt.value}
                disabled={opt.disabled || busy}
                onClick={() => {
                  if (isSingleDevice) void submit(opt.value);
                  else setSelected(opt.value);
                }}
              >
                {opt.value === 0 ? 'пас' : opt.value}
              </button>
            ))}
          </div>

          {isSingleDevice && <p className="faint">Нажмите цифру — заказ запишется сразу.</p>}
        </div>
      ) : (
        <div className="banner banner--info">Ждём заказ от {active?.name ?? 'игрока'}</div>
      )}

      <ConfirmDialog
        open={confirmUndo}
        busy={busy}
        title="Отменить последний заказ?"
        text={`Заказ ${lastBidderName ?? 'игрока'} будет стёрт, и его нужно будет ввести заново.`}
        confirmLabel="Отменить заказ"
        cancelLabel="Не надо"
        onCancel={() => setConfirmUndo(false)}
        onConfirm={() => {
          setConfirmUndo(false);
          onUndoBid();
        }}
      />

      {canBid && (isSingleDevice ? madeCount > 0 : true) && (
        <div className="actionbar">
          {isHost && madeCount > 0 && (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => setConfirmUndo(true)}
              title="Отменить последний заказ"
            >
              Отменить заказ
            </button>
          )}
          {!isSingleDevice && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={selected === null || busy || !activeBidder}
              onClick={() => selected !== null && void submit(selected)}
            >
              {selected === null
                ? 'Выберите заказ'
                : `Заказать ${selected === 0 ? 'пас' : selected}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
