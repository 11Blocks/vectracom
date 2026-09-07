'use client';

/**
 * Bootstrap MapLibre pour Next.js.
 * maplibre-gl@6 = ESM-only → imports nommés.
 * Worker servi depuis /public (évite /_next/undefined → carte bleue vide).
 */
import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

if (typeof window !== 'undefined') {
  try {
    setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);
  } catch {
    /* déjà configuré */
  }
}

/** Facade compatible avec l’API historique `maplibregl.Map` / `.Marker`… */
export const maplibregl = {
  Map,
  Marker,
  Popup,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
};

export default maplibregl;
