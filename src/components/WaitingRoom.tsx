import { ALLOWED_PLAYER_COUNTS, MAX_PLAYERS } from '../game/constants.js';
import { buildRoundPlan, maxCardsPerPlayer } from '../game/rounds.js';
import type { RoomView } from '../game/view.js';
import type { Uid } from '../types.js';

export default function WaitingRoom({
  view,
  myUid,
  busy,
  onJoin,
  onLeave,
  onMove,
  onStart,
}: {
  view: RoomView;
  myUid: Uid;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onMove: (uid: Uid, direction: number) => void;
  onStart: () => void;
}) {
  const { players, isHost, amAtTable, hostId, nextGameNumber } = view;
  const count = players.length;
  const countOk = (ALLOWED_PLAYER_COUNTS as readonly number[]).includes(count);
  const host = players.find((p) => p.uid === hostId);

  const share = async (): Promise<void> => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: view.name, url });
      else await navigator.clipboard?.writeText(url);
    } catch {
      // Пользователь закрыл диалог — ничего делать не нужно.
    }
  };

  return (
    <section className="stack">
      <div className="card stack stack--tight">
        <div className="row">
          <span className="card__title">
            За столом {count} из {MAX_PLAYERS}
          </span>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={share}>
            Позвать
          </button>
        </div>

        {count === 0 ? (
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Пока никого нет. Садитесь первым — станете хостом.
          </p>
        ) : (
          players.map((p, i) => (
            <div key={p.uid} className={`prow${p.uid === myUid ? ' prow--me' : ''}`}>
              <span className="prow__seat">{i + 1}</span>
              {p.photoURL && <img className="avatar" src={p.photoURL} alt="" />}
              <span className="prow__name">{p.name}</span>
              {p.uid === hostId && <span className="chip chip--accent">хост</span>}
              {isHost && count > 1 && (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    disabled={busy || i === 0}
                    onClick={() => onMove(p.uid, -1)}
                    aria-label={`${p.name} выше по кругу`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    disabled={busy || i === count - 1}
                    onClick={() => onMove(p.uid, 1)}
                    aria-label={`${p.name} ниже по кругу`}
                  >
                    ↓
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className={`banner banner--${countOk ? 'info' : 'warn'}`}>
        {countOk
          ? `Раздаём по ${maxCardsOf(count)} — всего ${buildRoundPlan(count).length} раундов`
          : 'Нужно чётное число игроков — 2, 4 или 6, чтобы колода из 36 карт раздалась полностью'}
      </div>

      {!isHost && amAtTable && (
        <p className="faint">Партию начинает хост — {host?.name ?? '—'}</p>
      )}

      <div className="actionbar">
        {amAtTable ? (
          <>
            <button type="button" className="btn btn--danger" disabled={busy} onClick={onLeave}>
              Выйти
            </button>
            {isHost && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!countOk || busy}
                onClick={onStart}
              >
                {nextGameNumber > 1 ? `Начать партию ${nextGameNumber}` : 'Начать партию'}
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || count >= MAX_PLAYERS}
            onClick={onJoin}
          >
            {count >= MAX_PLAYERS ? 'Стол занят' : 'Сесть за стол'}
          </button>
        )}
      </div>
    </section>
  );
}

function maxCardsOf(count: number): string {
  const max = maxCardsPerPlayer(count);
  return `${max} ${max === 1 ? 'карте' : 'карт'}`;
}
