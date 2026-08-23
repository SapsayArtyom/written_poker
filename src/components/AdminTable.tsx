import { useState } from 'react';
import { ALLOWED_PLAYER_COUNTS, MAX_PLAYERS } from '../game/constants.js';
import { buildRoundPlan, maxCardsPerPlayer } from '../game/rounds.js';
import type { RoomView } from '../game/view.js';
import type { Uid } from '../types.js';

/**
 * Настройка стола в режиме «один ведёт стол»: админ добавляет игроков руками,
 * задаёт им имена и выставляет порядок хода.
 */
export default function AdminTable({
  view,
  busy,
  onAdd,
  onRename,
  onRemove,
  onMove,
  onStart,
}: {
  view: RoomView;
  busy: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (uid: Uid, name: string) => Promise<boolean>;
  onRemove: (uid: Uid) => void;
  onMove: (uid: Uid, direction: number) => void;
  onStart: () => void;
}) {
  const { players, isHost, nextGameNumber } = view;
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Uid | null>(null);
  const [draft, setDraft] = useState('');

  const count = players.length;
  const countOk = (ALLOWED_PLAYER_COUNTS as readonly number[]).includes(count);
  const full = count >= MAX_PLAYERS;

  const add = async (): Promise<void> => {
    if (!newName.trim()) return;
    if (await onAdd(newName)) setNewName('');
  };

  const commitRename = async (uid: Uid): Promise<void> => {
    if (await onRename(uid, draft)) setEditing(null);
  };

  if (!isHost) {
    return (
      <section className="card stack stack--tight">
        <div className="banner banner--info">
          Этот стол ведёт один админ со своего устройства. Вы можете следить за игрой,
          но заказы и взятки вводит он.
        </div>
        {players.map((p, i) => (
          <div key={p.uid} className="prow">
            <span className="prow__seat">{i + 1}</span>
            <span className="prow__name">{p.name}</span>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="card stack stack--tight">
        <div className="row">
          <span className="card__title">
            Игроки {count} из {MAX_PLAYERS}
          </span>
          <span className="spacer" />
          <span className="faint">порядок хода сверху вниз</span>
        </div>

        {count === 0 && (
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Добавьте игроков — по одному имени за раз.
          </p>
        )}

        {players.map((p, i) =>
          editing === p.uid ? (
            <form
              key={p.uid}
              className="prow"
              onSubmit={(e) => {
                e.preventDefault();
                void commitRename(p.uid);
              }}
            >
              <span className="prow__seat">{i + 1}</span>
              <input
                className="input"
                style={{ flex: 1, minWidth: 0 }}
                maxLength={24}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label={`Новое имя для ${p.name}`}
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
                ОК
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setEditing(null)}
              >
                Отмена
              </button>
            </form>
          ) : (
            <div key={p.uid} className="prow">
              <span className="prow__seat">{i + 1}</span>
              <button
                type="button"
                className="prow__name"
                style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0 }}
                onClick={() => {
                  setEditing(p.uid);
                  setDraft(p.name);
                }}
                aria-label={`Переименовать ${p.name}`}
              >
                {p.name}
              </button>
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
              <button
                type="button"
                className="btn btn--danger btn--icon"
                disabled={busy}
                onClick={() => onRemove(p.uid)}
                aria-label={`Убрать ${p.name}`}
              >
                ×
              </button>
            </div>
          ),
        )}

        {!full && (
          <form
            className="row row--nowrap"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <input
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Имя игрока"
              maxLength={24}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="Имя нового игрока"
            />
            <button type="submit" className="btn" disabled={busy || !newName.trim()}>
              Добавить
            </button>
          </form>
        )}
      </div>

      <div className={`banner banner--${countOk ? 'info' : 'warn'}`}>
        {countOk
          ? `Раздаём по ${maxCardsPerPlayer(count)} карт — всего ${buildRoundPlan(count).length} раундов`
          : 'Нужно чётное число игроков — 2, 4 или 6, чтобы колода из 36 карт раздалась полностью'}
      </div>

      <div className="actionbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!countOk || busy}
          onClick={onStart}
        >
          {nextGameNumber > 1 ? `Начать партию ${nextGameNumber}` : 'Начать партию'}
        </button>
      </div>
    </section>
  );
}
