import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:3100/api/v1';

const TOKEN_KEY = 'vectracom_token';
const USER_KEY = 'vectracom_user';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId?: string | null;
  companyName?: string | null;
};

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
  const res = await fetch(`${API_URL}/auth/login`, {
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
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

  const res = await fetch(`${API_URL}/files/upload?category=${encodeURIComponent(category)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Upload ${res.status}`);
  return body.url as string;
}
