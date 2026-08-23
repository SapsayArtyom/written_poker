import { GAME_PHASE } from '../game/constants.js';
import type { GameView, RoomView } from '../game/view.js';

const PHASE_LABEL: Record<string, string> = {
  [GAME_PHASE.BIDDING]: 'Заказ взяток',
  [GAME_PHASE.RESULTS]: 'Отмечаем взятки',
  [GAME_PHASE.FINISHED]: 'Все раунды сыграны',
};

function cardsWord(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'карт';
  if (mod10 === 1) return 'карта';
  if (mod10 >= 2 && mod10 <= 4) return 'карты';
  return 'карт';
}

export default function RoundHeader({
  game,
  playersByUid,
  gameNumber,
}: {
  game: GameView;
  playersByUid: RoomView['playersByUid'];
  gameNumber: number;
}) {
  const { round, roundMeta, roundsTotal, phase, bidsSum } = game;
  const dealer = playersByUid[game.dealer]?.name ?? '—';
  const firstBidder = playersByUid[game.firstBidder]?.name ?? '—';
  const done = round.index + (phase === GAME_PHASE.RESULTS ? 1 : 0);
  const progress = Math.round((done / roundsTotal) * 100);

  return (
    <section className="card card--felt">
      <div className="round">
        <div className="round__cards">{round.cards}</div>

        <div className="round__body">
          <div className="round__kind" style={{ color: roundMeta.code ? roundMeta.color : undefined }}>
            {roundMeta.label}
            {roundMeta.multiplier > 1 && (
              <span className="chip" style={{ marginLeft: 8 }}>
                ×{roundMeta.multiplier}
              </span>
            )}
          </div>
          <div className="round__meta">
            Партия {gameNumber} · раунд {round.number} из {roundsTotal}
          </div>
          <div className="round__meta">
            Раздаёт <b>{dealer}</b>
            {round.hasBidding && (
              <>
                , первым заказывает <b>{firstBidder}</b>
              </>
            )}
          </div>
          <div className="round__meta">
            {PHASE_LABEL[phase]} · по {round.cards} {cardsWord(round.cards)}
            {phase === GAME_PHASE.BIDDING && round.hasBidding && (
              <> · заказано {bidsSum}, нельзя {round.cards}</>
            )}
          </div>
        </div>
      </div>

      <div className="progress" aria-hidden>
        <div className="progress__bar" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
