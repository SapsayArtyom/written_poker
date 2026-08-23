import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  updateProfile,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { requireAuth } from '../firebase/config.js';
import type { AuthUser, Player, Unsubscribe } from '../types.js';

const googleProvider = new GoogleAuthProvider();

export function observeAuth(callback: (user: AuthUser | null) => void): Unsubscribe {
  return onAuthStateChanged(requireAuth(), (user) =>
    callback(
      user
        ? {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            isAnonymous: user.isAnonymous,
          }
        : null,
    ),
  );
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const { user } = await signInWithPopup(requireAuth(), googleProvider);
  return {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  };
}

/** Гостевой вход: анонимный аккаунт Firebase плюс выбранный ник. */
export async function signInAsGuest(nickname?: string): Promise<AuthUser> {
  const { user } = await signInAnonymously(requireAuth());
  const displayName = nickname?.trim() || `Гость-${user.uid.slice(0, 4)}`;
  await updateProfile(user, { displayName });
  return { uid: user.uid, displayName, photoURL: null, isAnonymous: true };
}

export function signOut(): Promise<void> {
  return firebaseSignOut(requireAuth());
}

/** Публичный профиль игрока, который кладём в комнату. */
export function toPlayerProfile(user: AuthUser, nameOverride?: string): Player {
  return {
    uid: user.uid,
    name: nameOverride || user.displayName || `Игрок-${user.uid.slice(0, 4)}`,
    photoURL: user.photoURL ?? null,
    isGuest: user.isAnonymous,
  };
}
