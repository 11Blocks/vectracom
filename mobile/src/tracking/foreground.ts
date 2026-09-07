import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { getToken } from '../services/api';
import { recordMyPosition } from '../services/geolocation';

const INTERVAL_MS = 60_000;
const MIN_DISTANCE_M = 25;

let timer: ReturnType<typeof setInterval> | null = null;
let appSub: { remove: () => void } | null = null;
let lastSent: { lat: number; lon: number; at: number } | null = null;
let running = false;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function tick() {
  const token = await getToken();
  if (!token) return;
  if (AppState.currentState !== 'active') return;

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const now = Date.now();

    if (lastSent) {
      const moved = haversineM(lastSent.lat, lastSent.lon, lat, lon);
      const age = now - lastSent.at;
      // Skip if almost immobile and last send < 3 min (sauf 1er point de la session)
      if (moved < MIN_DISTANCE_M && age < 180_000) return;
    }

    const speedKmh =
      pos.coords.speed != null && pos.coords.speed >= 0
        ? Math.round(pos.coords.speed * 3.6 * 10) / 10
        : undefined;

    await recordMyPosition({
      latitude: lat,
      longitude: lon,
      accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : undefined,
      speedKmh,
      source: 'mobile',
    });
    lastSent = { lat, lon, at: now };
  } catch {
    // Licence absente, permission, réseau : file offline déjà gérée dans recordMyPosition
  }
}

async function ensurePermission(): Promise<boolean> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Démarre le suivi GPS au premier plan (intervalle 60 s). */
export async function startForegroundTracking() {
  if (running) return;
  const ok = await ensurePermission();
  if (!ok) return;

  running = true;
  await tick();
  timer = setInterval(() => {
    tick().catch(() => undefined);
  }, INTERVAL_MS);

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') tick().catch(() => undefined);
  };
  appSub = AppState.addEventListener('change', onAppState);
}

export function stopForegroundTracking() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  appSub?.remove();
  appSub = null;
  lastSent = null;
}

export function isTrackingRunning() {
  return running;
}
