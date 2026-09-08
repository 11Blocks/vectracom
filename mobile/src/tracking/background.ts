/**
 * Suivi GPS en arrière-plan (Phase G4).
 * TaskManager.defineTask DOIT être au top-level du module (importé tôt depuis App.tsx).
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { recordMyPosition } from '../services/geolocation';
import { colors } from '../theme/colors';

export const BACKGROUND_LOCATION_TASK = 'VECTRACOM_BACKGROUND_LOCATION';

const MIN_DISTANCE_M = 25;
const INTERVAL_MS = 60_000;

let lastSent: { lat: number; lon: number; at: number } | null = null;

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

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;

  const pos = locations[locations.length - 1];
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const now = Date.now();

  if (lastSent) {
    const moved = haversineM(lastSent.lat, lastSent.lon, lat, lon);
    const age = now - lastSent.at;
    if (moved < MIN_DISTANCE_M && age < 180_000) return;
  }

  const speedKmh =
    pos.coords.speed != null && pos.coords.speed >= 0
      ? Math.round(pos.coords.speed * 3.6 * 10) / 10
      : undefined;

  try {
    await recordMyPosition({
      latitude: lat,
      longitude: lon,
      accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : undefined,
      speedKmh,
      source: 'mobile',
    });
    lastSent = { lat, lon, at: now };
  } catch {
    /* file offline gérée dans recordMyPosition */
  }
});

async function ensureBackgroundPermission(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    const req = await Location.requestForegroundPermissionsAsync();
    if (req.status !== 'granted') return false;
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === 'granted') return true;
  const reqBg = await Location.requestBackgroundPermissionsAsync();
  return reqBg.status === 'granted';
}

/** Démarre les updates GPS système (fonctionne app en arrière-plan / écran off). */
export async function startBackgroundTracking(): Promise<boolean> {
  const ok = await ensureBackgroundPermission();
  if (!ok) return false;

  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) return true;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: INTERVAL_MS,
    distanceInterval: MIN_DISTANCE_M,
    deferredUpdatesInterval: INTERVAL_MS,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: true,
    foregroundService: {
      notificationTitle: 'VECTRACOM — suivi GPS',
      notificationBody: 'Localisation active pour le suivi terrain',
      notificationColor: colors.primary,
    },
  });
  return true;
}

export async function stopBackgroundTracking() {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    /* task absente */
  }
  lastSent = null;
}

export async function isBackgroundTrackingRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}
