export default function ErrorBanner({
  message,
  onClose,
  kind = 'error',
}: {
  message: string | null;
  onClose?: () => void;
  kind?: 'error' | 'info' | 'warn' | 'good';
}) {
  if (!message) return null;
  return (
    <div className={`banner banner--${kind}`} role="alert">
      <span>{message}</span>
      {onClose && (
        <button type="button" className="banner__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      )}
    </div>
  );
}
