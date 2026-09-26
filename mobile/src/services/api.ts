import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const TOKEN_KEY = 'vectracom_token';
const USER_KEY = 'vectracom_user';
const API_URL_KEY = 'vectracom_api_url';

const DEFAULT_API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:3100/api/v1';

let apiUrlOverride: string | null = null;

/** URL API effective (override AsyncStorage ou app.json). */
export function getApiUrl(): string {
  return (apiUrlOverride || DEFAULT_API_URL).replace(/\/$/, '');
}

/** @deprecated Prefer getApiUrl() — conservé pour imports existants. */
export const API_URL = DEFAULT_API_URL;

export async function loadApiUrlOverride() {
  const v = await AsyncStorage.getItem(API_URL_KEY);
  apiUrlOverride = v?.trim() || null;
}

export async function setApiUrlOverride(url: string | null) {
  const cleaned = url?.trim().replace(/\/$/, '') || null;
  if (cleaned) await AsyncStorage.setItem(API_URL_KEY, cleaned);
  else await AsyncStorage.removeItem(API_URL_KEY);
  apiUrlOverride = cleaned;
}

export function getDefaultApiUrl() {
  return DEFAULT_API_URL;
}

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId?: string | null;
  companyName?: string | null;
  mustChangePassword?: boolean;
};

type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

/** App s’abonne pour revenir à l’écran login si le JWT expire (12h). */
export function onAuthExpired(listener: AuthExpiredListener) {
  authExpiredListeners.add(listener);
  return () => {
    authExpiredListeners.delete(listener);
  };
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function setSession(accessToken: string, user: AuthUser) {
  await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function login(email: string, password: string) {
  const res = await fetch(`${getApiUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Erreur ${res.status}`);
  await setSession(body.accessToken, body.user);
  return body as { accessToken: string; user: AuthUser };
}

export async function logout() {
  await clearSession();
}

/** Changement de son mot de passe : le serveur révoque les anciens jetons et en renvoie un nouveau. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await request<{ accessToken?: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const user = await getUser();
  if (res?.accessToken && user) await setSession(res.accessToken, { ...user, mustChangePassword: false });
}

export async function requestPasswordReset(email: string) {
  const res = await fetch(`${getApiUrl()}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Erreur ${res.status}`);
  return body as { message: string };
}

type PasswordChangeListener = () => void;
const passwordChangeListeners = new Set<PasswordChangeListener>();

/** Mot de passe temporaire : l'API refuse tout sauf « mon compte » tant qu'il n'est pas changé. */
export function onPasswordChangeRequired(listener: PasswordChangeListener) {
  passwordChangeListeners.add(listener);
  return () => {
    passwordChangeListeners.delete(listener);
  };
}

export async function pingHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/health`, { method: 'GET' });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const body = await res.json().catch(() => ({}));
    return { ok: true, detail: body.db === 'up' ? 'API + DB OK' : 'API OK' };
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Injoignable' };
  }
}

/** Échec de transport (pas de réponse du serveur) : seul cas où l'on met en file hors-ligne. */
export class NetworkError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
  } catch {
    throw new NetworkError('Réseau indisponible — vérifiez le Wi‑Fi et l’API');
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    await clearSession();
    notifyAuthExpired();
    throw new Error('Session expirée — reconnectez-vous');
  }

  if (res.status === 403 && body?.code === 'PASSWORD_CHANGE_REQUIRED') {
    const user = await getUser();
    const token = await getToken();
    if (user && token) await setSession(token, { ...user, mustChangePassword: true });
    passwordChangeListeners.forEach((l) => {
      try {
        l();
      } catch {
        /* ignore */
      }
    });
  }

  if (!res.ok) {
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(msg || `Erreur ${res.status}`);
  }
  return body as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T = any>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T = any>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Upload multipart → { url } — ne rejoue pas si déjà remote. */
export async function uploadFile(localUri: string, category = 'missions'): Promise<string> {
  if (/^https?:\/\//i.test(localUri)) return localUri;
  const token = await getToken();
  const form = new FormData();
  const name = localUri.split('/').pop() || `photo-${Date.now()}.jpg`;
  form.append('file', {
    uri: localUri,
    name,
    type: 'image/jpeg',
  } as any);

  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}/files/upload?category=${encodeURIComponent(category)}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new NetworkError('Réseau indisponible — upload impossible');
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await clearSession();
    notifyAuthExpired();
    throw new Error('Session expirée — reconnectez-vous');
  }
  if (!res.ok) throw new Error(body.message || `Upload ${res.status}`);
  return body.url as string;
}
