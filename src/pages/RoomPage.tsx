import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRoomStore } from '../store/roomStore.js';
import { useAuthStore } from '../store/authStore.js';
import { selectRoomView } from '../game/view.js';
import { GAME_PHASE, ROOM_STATUS } from '../game/constants.js';
import ErrorBanner from '../components/ErrorBanner.js';
import AdminTable from '../components/AdminTable.js';
import WaitingRoom from '../components/WaitingRoom.js';
import RoomSettings from '../components/RoomSettings.js';
import GamesArchive from '../components/GamesArchive.js';
import RoundHeader from '../components/RoundHeader.js';
import BiddingPanel from '../components/BiddingPanel.js';
import ResultsPanel from '../components/ResultsPanel.js';
import ScoreSheet from '../components/ScoreSheet.js';
import FinalStandings from '../components/FinalStandings.js';
import RulesInfo from '../components/RulesInfo.js';
import ConfirmDialog from '../components/ConfirmDialog.js';
import Tabs from '../components/Tabs.js';

type Pane = 'move' | 'sheet';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const user = useAuthStore((s) => s.user);
  const store = useRoomStore();
  const { room, loading, notFound, busy, error } = store;
  const [pane, setPane] = useState<Pane>('move');
  const [confirmReset, setConfirmReset] = useState(false);
  const navigate = useNavigate();

  const subscribe = store.subscribe;
  const dispose = store.dispose;

  useEffect(() => {
    if (!roomId) return;
    subscribe(roomId);
    return dispose;
  }, [roomId, subscribe, dispose]);

  const view = useMemo(() => selectRoomView(room, user?.uid), [room, user?.uid]);

  if (!user) return null;

  if (loading) {
    return (
      <main className="page">
        <div className="center-note">
          <div className="spinner" />
          Заходим за стол…
        </div>
      </main>
    );
  }

  if (notFound || !view) {
    return (
      <main className="page page--centered">
        <section className="card stack">
          <h2>Стол не найден</h2>
          <Link to="/lobby" className="btn btn--primary btn--block">
            Вернуться в лобби
          </Link>
        </section>
      </main>
    );
  }

  const game = view.game;
  const inGame = view.status === ROOM_STATUS.PLAYING || view.status === ROOM_STATUS.FINISHED;
  const showActionbar = !inGame || pane === 'move';

  const deleteRoom = async (): Promise<void> => {
    if (await store.remove(user.uid)) navigate('/lobby');
  };

  return (
    <main className={`page${showActionbar ? ' page--with-actionbar' : ''}`}>
      <div className="row row--nowrap">
        <Link to="/lobby" className="btn btn--ghost btn--sm" aria-label="В лобби">
          ←
        </Link>
        <h1 className="truncate">{view.name}</h1>
        {view.isHost && (
          <span className="chip chip--accent">{view.isSingleDevice ? 'вы админ' : 'вы хост'}</span>
        )}
      </div>

      <ErrorBanner message={error} onClose={store.clearError} />

      {!inGame && (
        <div className="table-layout">
          <div className="stack">
            {view.isSingleDevice ? (
              <AdminTable
                view={view}
                busy={busy}
                onAdd={(name) => store.addPlayer(user.uid, name)}
                onRename={(uid, name) => store.renamePlayer(user.uid, uid, name)}
                onRemove={(uid) => void store.removePlayer(user.uid, uid)}
                onMove={(uid, direction) => void store.move(uid, direction)}
                onStart={() => void store.start(user.uid)}
              />
            ) : (
              <WaitingRoom
                view={view}
                myUid={user.uid}
                busy={busy}
                onJoin={() => void store.join(user)}
                onLeave={() => void store.leave(user.uid)}
                onMove={(uid, direction) => void store.move(uid, direction)}
                onStart={() => void store.start(user.uid)}
              />
            )}
            <RoomSettings
              view={view}
              busy={busy}
              onRename={(name) => store.rename(user.uid, name)}
              onDelete={() => void deleteRoom()}
            />
          </div>

          <div className="stack">
            <GamesArchive games={view.games} />
            <RulesInfo playerCount={view.players.length} rules={view.rules} />
          </div>
        </div>
      )}

      {inGame && game && (
        <>
          <RoundHeader
            game={game}
            playersByUid={view.playersByUid}
            gameNumber={view.nextGameNumber}
          />

          <Tabs<Pane>
            items={[
              { id: 'move', label: game.isFinished ? 'Итоги' : 'Ход' },
              { id: 'sheet', label: 'Расписка' },
            ]}
            active={pane}
            onChange={setPane}
          />

          <div className="table-layout">
            <div className={pane === 'move' ? undefined : 'pane--hidden'}>
              {game.phase === GAME_PHASE.BIDDING && (
                <BiddingPanel
                  view={view}
                  myUid={user.uid}
                  busy={busy}
                  onBid={({ targetUid, value }) =>
                    store.bid({ actorUid: user.uid, targetUid, value })
                  }
                  onUndoBid={() => void store.undoBid(user.uid)}
                />
              )}

              {game.phase === GAME_PHASE.RESULTS && (
                <ResultsPanel
                  key={game.roundIndex}
                  view={view}
                  myUid={user.uid}
                  busy={busy}
                  onClose={(tricks) => void store.closeRound({ actorUid: user.uid, tricks })}
                  onUndoRound={() => void store.undoRound(user.uid)}
                />
              )}

              {game.phase === GAME_PHASE.FINISHED && (
                <FinalStandings
                  view={view}
                  myUid={user.uid}
                  busy={busy}
                  onArchive={() => void store.archive(user.uid)}
                />
              )}
            </div>

            <div className={pane === 'sheet' ? 'stack' : 'stack pane--hidden'}>
              <ScoreSheet view={view} />

              {view.isHost && !game.isFinished && (
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={busy}
                  onClick={() => setConfirmReset(true)}
                >
                  Сбросить партию
                </button>
              )}
            </div>
          </div>

          <ConfirmDialog
            open={confirmReset}
            danger
            busy={busy}
            title="Сбросить партию?"
            text="Вся расписка этой партии будет удалена, и в архив стола она не попадёт. Состав игроков останется."
            confirmLabel="Сбросить"
            onCancel={() => setConfirmReset(false)}
            onConfirm={() => {
              setConfirmReset(false);
              void store.reset(user.uid);
            }}
          />
        </>
      )}
    </main>
  );
}
