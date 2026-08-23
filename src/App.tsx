import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import TopBar from './components/TopBar.js';
import LoginPage from './pages/LoginPage.js';
import LobbyPage from './pages/LobbyPage.js';
import RoomPage from './pages/RoomPage.js';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="app">
      <TopBar />
      {loading ? (
        <main className="page">
          <div className="center-note">
            <div className="spinner" />
            Проверяем вход…
          </div>
        </main>
      ) : (
        <Routes>
          {!user ? (
            <>
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/room/:roomId" element={<RoomPage />} />
              <Route path="*" element={<Navigate to="/lobby" replace />} />
            </>
          )}
        </Routes>
      )}
    </div>
  );
}
