import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export default function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <Link to="/lobby" className="topbar__brand">
        <span aria-hidden>♠</span>
        Расписной покер
      </Link>
      <div className="spacer" />
      {user && (
        <>
          {user.photoURL && <img className="avatar" src={user.photoURL} alt="" />}
          <span className="truncate muted" style={{ fontSize: '0.85rem', maxWidth: '9rem' }}>
            {user.name}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Выйти
          </button>
        </>
      )}
    </header>
  );
}
