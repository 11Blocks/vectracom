'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vectracom_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('vectracom_token', token);
  else localStorage.removeItem('vectracom_token');
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Erreur ${res.status}`);
  }
  return res.json();
}

async function upload<T = any>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Erreur ${res.status}`);
  }
  return res.json();
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
  upload: <T = any>(path: string, formData: FormData) => upload<T>(path, formData),
  getBlob: async (path: string): Promise<Blob> => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${path}`, { headers });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return res.blob();
  },
  postBlob: async (path: string, data?: unknown): Promise<Blob> => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return res.blob();
  },
};
