import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../store/lobbyStore.js';
import { useAuthStore } from '../store/authStore.js';
import { MAX_PLAYERS, ROOM_MODE, ROOM_MODE_META, ROOM_STATUS } from '../game/constants.js';
import { backendKind } from '../services/backend.js';
import ErrorBanner from '../components/ErrorBanner.js';
import SetupNotice from '../components/SetupNotice.js';
import type { RoomMode, RoomStatus } from '../types.js';

const STATUS_LABEL: Record<RoomStatus, string> = {
  [ROOM_STATUS.WAITING]: 'Ждём игроков',
  [ROOM_STATUS.PLAYING]: 'Игра идёт',
  [ROOM_STATUS.FINISHED]: 'Игра закончена',
};

export default function LobbyPage() {
  const { rooms, loading, error, init, dispose, create, clearError } = useLobbyStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<RoomMode>(ROOM_MODE.SINGLE);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void init();
    return dispose;
  }, [init, dispose]);

  if (!user) return null;

  const onCreate = async (): Promise<void> => {
    const id = await create(name, user, mode);
    if (id) {
      setName('');
      setCreating(false);
      navigate(`/room/${id}`);
    }
  };

  return (
    <main className="page">
      <div className="row">
        <h1>Лобби</h1>
        <span className="faint">выберите стол</span>
      </div>

      <ErrorBanner message={error} onClose={clearError} />
      {backendKind === 'local' && <SetupNotice />}

      {loading ? (
        <div className="center-note">
          <div className="spinner" />
          Загружаем столы…
        </div>
      ) : (
        <div className="stack stack--tight">
          {rooms.map((room) => {
            const players = room.players ?? [];
            const single = (room.mode ?? ROOM_MODE.ONLINE) === ROOM_MODE.SINGLE;
            const mine = players.some((p) => p.uid === user.uid);
            const admin = single && room.hostId === user.uid;
            return (
              <button
                key={room.id}
                type="button"
                className="card row row--nowrap"
                style={{ textAlign: 'left', width: '100%' }}
                onClick={() => navigate(`/room/${room.id}`)}
              >
                <span className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
                  <span className="row row--nowrap" style={{ gap: 6 }}>
                    <span className="truncate" style={{ fontWeight: 600 }}>
                      {room.name}
                    </span>
                    {single && <span className="chip">один ведёт</span>}
                    {(mine || admin) && <span className="chip chip--accent">вы здесь</span>}
                  </span>
                  <span className="faint truncate">
                    {STATUS_LABEL[room.status] ?? room.status} · {players.length}/{MAX_PLAYERS}
                    {players.length > 0 && ` · ${players.map((p) => p.name).join(', ')}`}
                  </span>
                </span>
                <span className="chip" aria-hidden>
                  ›
                </span>
              </button>
            );
          })}
        </div>
      )}

      {creating ? (
        <form
          className="card stack stack--tight"
          onSubmit={(e) => {
            e.preventDefault();
            void onCreate();
          }}
        >
          <div>
            <label className="label" htmlFor="room-name">
              Название стола
            </label>
            <input
              id="room-name"
              className="input"
              placeholder="Пятничная игра"
              maxLength={40}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="label">Режим</legend>
            <div className="stack stack--tight">
              {([ROOM_MODE.SINGLE, ROOM_MODE.ONLINE] as RoomMode[]).map((value) => (
                <label
                  key={value}
                  className={`prow${mode === value ? ' prow--active' : ''}`}
                  style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    style={{ marginTop: 4, accentColor: 'var(--accent)' }}
                  />
                  <span className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{ROOM_MODE_META[value].label}</span>
                    <span className="faint">{ROOM_MODE_META[value].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="row row--nowrap">
            <button
              type="button"
              className="btn btn--ghost"
              style={{ flex: 1 }}
              onClick={() => setCreating(false)}
            >
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>
              Создать
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn--block" onClick={() => setCreating(true)}>
          Новый стол
        </button>
      )}
    </main>
  );
}
