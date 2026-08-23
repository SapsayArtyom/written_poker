import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog.js';
import type { RoomView } from '../game/view.js';

/** Переименование и удаление стола — доступно только админу. */
export default function RoomSettings({
  view,
  busy,
  onRename,
  onDelete,
}: {
  view: RoomView;
  busy: boolean;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(view.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!view.isHost) return null;

  const dirty = name.trim() !== view.name && name.trim().length > 0;

  return (
    <section className="card stack stack--tight">
      <span className="card__title">Стол</span>

      <form
        className="row row--nowrap"
        onSubmit={(e) => {
          e.preventDefault();
          void onRename(name);
        }}
      >
        <input
          className="input"
          style={{ flex: 1, minWidth: 0 }}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Название стола"
        />
        <button type="submit" className="btn" disabled={busy || !dirty}>
          Сохранить
        </button>
      </form>

      <button
        type="button"
        className="btn btn--danger btn--sm"
        style={{ alignSelf: 'flex-start' }}
        disabled={busy}
        onClick={() => setConfirmDelete(true)}
      >
        Удалить стол
      </button>

      <ConfirmDialog
        open={confirmDelete}
        danger
        busy={busy}
        title="Удалить стол?"
        text={
          view.games.length > 0
            ? `Вместе со столом исчезнут ${view.games.length} сыгранных партий и состав игроков. Отменить это будет нельзя.`
            : 'Стол и его состав игроков исчезнут. Отменить это будет нельзя.'
        }
        confirmLabel="Удалить"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
      />
    </section>
  );
}
