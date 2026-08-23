import { useEffect } from 'react';

/**
 * Подтверждение опасного действия. На телефоне выезжает снизу — там, где палец,
 * и там же, где обычно стоит кнопка, по которой пользователь только что нажал.
 */
export default function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = 'Продолжить',
  cancelLabel = 'Отмена',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {text && <p className="muted" style={{ fontSize: '0.9rem' }}>{text}</p>}
        <div className="row row--nowrap">
          <button
            type="button"
            className="btn btn--ghost"
            style={{ flex: 1 }}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            style={{ flex: 1 }}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
