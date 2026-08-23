import { useState } from 'react';
import { backendKind } from '../services/backend.js';
import { useAuthStore } from '../store/authStore.js';
import ErrorBanner from '../components/ErrorBanner.js';

export default function LoginPage() {
  const { loginWithGoogle, loginAsGuest, error, clearError } = useAuthStore();
  const [nickname, setNickname] = useState('');
  const [pending, setPending] = useState<'google' | 'guest' | null>(null);

  const run = async (kind: 'google' | 'guest', action: () => Promise<void>): Promise<void> => {
    setPending(kind);
    await action();
    setPending(null);
  };

  return (
    <main className="page page--centered">
      <section className="card stack">
        <div className="stack stack--tight">
          <h1>Расписной покер</h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Войдите, чтобы сесть за стол
          </p>
        </div>

        <ErrorBanner message={error} onClose={clearError} />

        {backendKind === 'firebase' && (
          <>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={pending !== null}
              onClick={() => run('google', loginWithGoogle)}
            >
              {pending === 'google' ? 'Открываем окно входа…' : 'Войти через Google'}
            </button>

            <div className="row row--nowrap">
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="faint">или</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          </>
        )}

        <form
          className="stack stack--tight"
          onSubmit={(e) => {
            e.preventDefault();
            void run('guest', () => loginAsGuest(nickname));
          }}
        >
          <div>
            <label className="label" htmlFor="nickname">
              Имя за столом
            </label>
            <input
              id="nickname"
              className="input"
              placeholder="Например, Хэрри"
              maxLength={24}
              autoComplete="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className={`btn btn--block${backendKind === 'local' ? ' btn--primary' : ''}`}
            disabled={pending !== null}
          >
            {pending === 'guest' ? 'Заходим…' : 'Играть'}
          </button>
        </form>
      </section>
    </main>
  );
}
