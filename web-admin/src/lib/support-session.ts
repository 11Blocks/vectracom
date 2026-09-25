'use client';

const SAVED_TOKEN = 'vectracom_support_token';
const SAVED_USER = 'vectracom_support_user';

/** Démarre une session support : la session console est mise de côté puis remplacée. */
export function startSupportSession(res: { accessToken: string; user: any }) {
  if (!localStorage.getItem(SAVED_TOKEN)) {
    localStorage.setItem(SAVED_TOKEN, localStorage.getItem('vectracom_token') ?? '');
    localStorage.setItem(SAVED_USER, localStorage.getItem('vectracom_user') ?? '');
  }
  localStorage.setItem('vectracom_token', res.accessToken);
  localStorage.setItem('vectracom_user', JSON.stringify(res.user));
}

export function inSupportSession(): boolean {
  return typeof window !== 'undefined' && Boolean(localStorage.getItem(SAVED_TOKEN));
}

/** Restaure la session console ; retourne false s'il n'y avait pas de session support. */
export function endSupportSession(): boolean {
  const token = localStorage.getItem(SAVED_TOKEN);
  if (!token) return false;
  localStorage.setItem('vectracom_token', token);
  localStorage.setItem('vectracom_user', localStorage.getItem(SAVED_USER) ?? '');
  localStorage.removeItem(SAVED_TOKEN);
  localStorage.removeItem(SAVED_USER);
  return true;
}
