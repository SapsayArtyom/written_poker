import { useState } from 'react';

/**
 * Показывается в локальном режиме: объясняет, что данные лежат в браузере,
 * и как подключить настоящий Firebase.
 */
export default function SetupNotice() {
  const [open, setOpen] = useState(false);

  return (
    <section className="card stack stack--tight">
      <div className="banner banner--warn">
        <span>
          <b>Локальный режим.</b> Firebase не подключён — столы и расписка хранятся в этом
          браузере. Игру на несколько человек можно проверить, открыв несколько окон: они
          синхронизируются между собой.
        </span>
      </div>

      <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen((v) => !v)}>
        {open ? 'Свернуть' : 'Как подключить Firebase'}
      </button>

      {open && (
        <>
          <div>
            <div className="card__title">Вариант 1 — проект Firebase</div>
            <ul className="rules">
              <li>
                Создать проект в{' '}
                <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
                  Firebase Console
                </a>
              </li>
              <li>
                Authentication → Sign-in method → включить <b>Google</b> и <b>Anonymous</b>
              </li>
              <li>Firestore Database → создать базу</li>
              <li>
                Конфиг из Project settings → Your apps положить в <code>.env</code> по образцу{' '}
                <code>.env.example</code> и перезапустить <code>npm run dev</code>
              </li>
            </ul>
          </div>

          <div>
            <div className="card__title">Вариант 2 — локальные эмуляторы</div>
            <pre>{`npm i -g firebase-tools
cd firebase && firebase emulators:start --only auth,firestore`}</pre>
            <p className="faint">
              В <code>.env</code> поставить <code>VITE_USE_EMULATORS=true</code>. Эмулятору
              Firestore нужна установленная Java.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
