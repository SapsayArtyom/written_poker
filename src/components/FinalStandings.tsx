import Points from './Points.jsx';
import type { RoomView } from '../game/view.js';
import type { Uid } from '../types.js';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function FinalStandings({
  view,
  myUid,
  busy,
  onArchive,
}: {
  view: RoomView;
  myUid: Uid;
  busy: boolean;
  onArchive: () => void;
}) {
  const winner = view.standings[0];

  return (
    <section className="stack">
      <div className="card stack stack--tight">
        <h2>Партия {view.nextGameNumber} завершена</h2>
        {winner && (
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Победитель — {winner.name}, {winner.total} очков
          </p>
        )}

        {view.standings.map((p) => (
          <div key={p.uid} className={`standing${p.place === 1 ? ' standing--first' : ''}`}>
            <span className="standing__place">{MEDAL[p.place] ?? p.place}</span>
            {p.photoURL && <img className="avatar" src={p.photoURL} alt="" />}
            <span className="prow__name">
              {p.name}
              {p.uid === myUid && <span className="chip" style={{ marginLeft: 8 }}>вы</span>}
            </span>
            <span className="standing__total">
              <Points value={p.total} showPlus={false} className="" />
            </span>
          </div>
        ))}
      </div>

      {view.isHost && (
        <div className="actionbar">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={onArchive}>
            К столу — новая партия
          </button>
        </div>
      )}
      {!view.isHost && (
        <p className="faint">Следующую партию начинает {view.isSingleDevice ? 'админ' : 'хост'}.</p>
      )}
    </section>
  );
}
