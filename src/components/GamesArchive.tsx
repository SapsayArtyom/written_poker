import Points from './Points.js';
import type { FinishedGame } from '../types.js';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** Сыгранные за этим столом партии — от свежих к старым. */
export default function GamesArchive({ games }: { games: FinishedGame[] }) {
  if (games.length === 0) return null;

  return (
    <section className="card stack stack--tight">
      <div className="row">
        <span className="card__title">Сыгранные партии</span>
        <span className="spacer" />
        <span className="faint">{games.length}</span>
      </div>

      {[...games].reverse().map((game) => (
        <div key={game.number} className="stack stack--tight" style={{ gap: 4 }}>
          <div className="row">
            <span style={{ fontWeight: 600 }}>Партия {game.number}</span>
            <span className="faint">{game.rounds} раундов</span>
          </div>
          {game.results.map((r) => (
            <div key={r.uid} className="prow">
              <span className="prow__seat">{MEDAL[r.place] ?? r.place}</span>
              <span className="prow__name">{r.name}</span>
              <span className="points">
                <Points value={r.total} showPlus={false} className="" />
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
