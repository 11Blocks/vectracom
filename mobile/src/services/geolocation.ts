import { api } from './api';
import { enqueue, flushQueue } from '../offline/queue';

export type RecordMyPositionPayload = {
  latitude: number;
  longitude: number;
  recordedAt?: string;
  accuracyM?: number;
  speedKmh?: number;
  batteryPct?: number;
  missionId?: string;
  source?: 'mobile' | 'mission_check' | 'vehicle_gps';
};

export type RecordMyPositionResult =
  | { status: 'sent'; data: unknown }
  | { status: 'queued'; error?: string };

/** Envoie un point GPS ; en file offline si réseau / API indisponible. */
export async function recordMyPosition(payload: RecordMyPositionPayload): Promise<RecordMyPositionResult> {
  const body = {
    ...payload,
    source: payload.source ?? 'mobile',
    recordedAt: payload.recordedAt ?? new Date().toISOString(),
  };
  try {
    const data = await api.post('/geolocation/positions/me', body);
    return { status: 'sent', data };
  } catch (e: any) {
    await enqueue({
      method: 'POST',
      path: '/geolocation/positions/me',
      body,
    });
    flushQueue().catch(() => undefined);
    return { status: 'queued', error: e?.message };
  }
}
