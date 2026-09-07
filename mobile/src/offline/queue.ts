import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, uploadFile } from '../services/api';

const QUEUE_KEY = 'vectracom_offline_queue';
const MISSION_SYNC_KEY = 'vectracom_mission_sync';

export type QueueStatus = 'pending' | 'uploading' | 'success' | 'failed';

export type QueueItem = {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH';
  path: string;
  body: Record<string, unknown>;
  /** Chemins locaux à uploader avant envoi (remplacés dans body via jsonPath). */
  localFiles?: Array<{ jsonPath: string; uri: string; category?: string }>;
  status: QueueStatus;
  error?: string;
  createdAt: string;
  missionId?: string;
};

export type MissionSyncState = 'idle' | 'pending_sync' | 'synced' | 'failed';

async function readQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function readMissionSync(): Promise<Record<string, MissionSyncState>> {
  const raw = await AsyncStorage.getItem(MISSION_SYNC_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, MissionSyncState>;
  } catch {
    return {};
  }
}

async function writeMissionSync(map: Record<string, MissionSyncState>) {
  await AsyncStorage.setItem(MISSION_SYNC_KEY, JSON.stringify(map));
}

export async function getMissionSyncState(missionId: string): Promise<MissionSyncState> {
  const map = await readMissionSync();
  return map[missionId] ?? 'idle';
}

export async function getAllMissionSyncStates(): Promise<Record<string, MissionSyncState>> {
  return readMissionSync();
}

export async function setMissionSyncState(missionId: string, state: MissionSyncState) {
  const map = await readMissionSync();
  map[missionId] = state;
  await writeMissionSync(map);
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);
    if (cur[key] == null) cur[key] = nextIsIndex ? [] : {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Remplace récursivement les URI locales déjà uploadées dans le body. */
function replaceLocalUris(node: unknown, uploaded: Map<string, string>): unknown {
  if (typeof node === 'string') {
    if (uploaded.has(node)) return uploaded.get(node);
    return node;
  }
  if (Array.isArray(node)) return node.map((x) => replaceLocalUris(x, uploaded));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = replaceLocalUris(v, uploaded);
    }
    return out;
  }
  return node;
}

function isLocalUri(uri: string) {
  return !!uri && !/^https?:\/\//i.test(uri);
}

export async function enqueue(item: Omit<QueueItem, 'id' | 'status' | 'createdAt' | 'error'>): Promise<QueueItem> {
  const full: QueueItem = {
    ...item,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const q = await readQueue();
  q.push(full);
  await writeQueue(q);
  if (item.missionId) await setMissionSyncState(item.missionId, 'pending_sync');
  return full;
}

export async function listQueue(): Promise<QueueItem[]> {
  return readQueue();
}

export async function pendingCount(): Promise<number> {
  const q = await readQueue();
  return q.filter((i) => i.status === 'pending' || i.status === 'failed').length;
}

/** Flush : ne rejoue que pending/failed ; photos déjà success ne sont pas re-uploadées. */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const q = await readQueue();
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < q.length; i++) {
    const item = q[i];
    if (item.status === 'success') continue;
    if (item.status !== 'pending' && item.status !== 'failed') continue;

    item.status = 'uploading';
    await writeQueue(q);

    try {
      let body = JSON.parse(JSON.stringify(item.body)) as Record<string, unknown>;
      const uploaded = new Map<string, string>();

      for (const file of item.localFiles ?? []) {
        const uri = file.uri;
        if (!uri) continue;
        if (!isLocalUri(uri)) {
          setByPath(body, file.jsonPath, uri);
          continue;
        }
        // Ne re-uploade pas une URI déjà traitée dans cette passe
        if (uploaded.has(uri)) {
          setByPath(body, file.jsonPath, uploaded.get(uri)!);
          continue;
        }
        const url = await uploadFile(uri, file.category ?? 'missions');
        uploaded.set(uri, url);
        file.uri = url; // état success local — évite doublon au prochain flush
        setByPath(body, file.jsonPath, url);
      }

      body = replaceLocalUris(body, uploaded) as Record<string, unknown>;

      if (item.method === 'POST') await api.post(item.path, body);
      else if (item.method === 'PUT') await api.put(item.path, body);
      else await api.patch(item.path, body);

      item.status = 'success';
      item.error = undefined;
      ok++;
      if (item.missionId) {
        const still = q.some(
          (x) =>
            x.missionId === item.missionId &&
            x.id !== item.id &&
            (x.status === 'pending' || x.status === 'failed' || x.status === 'uploading'),
        );
        if (!still) await setMissionSyncState(item.missionId, 'synced');
      }
    } catch (e: any) {
      item.status = 'failed';
      item.error = e?.message ?? 'Erreur sync';
      failed++;
      if (item.missionId) await setMissionSyncState(item.missionId, 'failed');
    }
    await writeQueue(q);
  }

  const fresh = await readQueue();
  const keep = [
    ...fresh.filter((x) => x.status !== 'success'),
    ...fresh.filter((x) => x.status === 'success').slice(-20),
  ];
  await writeQueue(keep);

  return { ok, failed };
}

let flushTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoFlush(intervalMs = 45000) {
  if (flushTimer) return;
  flushQueue().catch(() => undefined);
  flushTimer = setInterval(() => {
    flushQueue().catch(() => undefined);
  }, intervalMs);
}

export function stopAutoFlush() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}
