/**
 * Человеческие тексты для типовых ошибок Firebase.
 * Правила игры бросают уже готовые сообщения — их отдаём как есть.
 */
export function humanizeError(e: unknown): string {
  const error = e as { code?: string; message?: string };
  const code = error?.code ?? '';
  const message = error?.message ?? '';

  if (code === 'permission-denied' || message.includes('Missing or insufficient permissions')) {
    return 'Firestore отклонил запрос. Опубликуйте правила из firebase/firestore.rules '
      + '(Firebase Console → Firestore Database → Rules) и включите вход '
      + '(Authentication → Sign-in method).';
  }
  if (code === 'unauthenticated') {
    return 'Firestore требует авторизации — войдите заново';
  }
  if (code === 'failed-precondition' || code === 'not-found') {
    return 'База Firestore недоступна. Проверьте, что она создана в Firebase Console.';
  }
  if (code === 'unavailable' || code === 'auth/network-request-failed') {
    return 'Нет связи с Firebase — проверьте интернет';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Этот способ входа выключен в Firebase Console '
      + '(Authentication → Sign-in method → Anonymous / Google)';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Домен не в списке разрешённых (Authentication → Settings → Authorized domains)';
  }
  if (code === 'auth/popup-closed-by-user') return 'Окно входа закрыто';
  if (code === 'auth/popup-blocked') return 'Браузер заблокировал всплывающее окно входа';

  return message || 'Что-то пошло не так';
}
