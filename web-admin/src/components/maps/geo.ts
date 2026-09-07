/** Helpers géo pour MapLibre (cercles géofence, bounds). */

export type LngLat = [number, number]; // [lng, lat]

/** Polygone cercle approximatif (GeoJSON) autour d'un centre, rayon en mètres. */
export function circlePolygon(lng: number, lat: number, radiusM: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: LngLat[] = [];
  const R = 6_371_000;
  const d = radiusM / R;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(brng));
    const lng2 =
      lngRad +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(latRad),
        Math.cos(d) - Math.sin(latRad) * Math.sin(lat2),
      );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

export function fitBoundsFromPoints(
  points: Array<{ lat: number; lng: number }>,
  pad = 0.01,
): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

const MAPTILER_KEY =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim()) || '';

/**
 * Dark Matter via MapTiler — tuiles raster (fiables sous Next.js).
 * Le style vectoriel MapTiler reste souvent « bleu vide » si le worker MapLibre
 * ne charge pas ; le raster affiche bien fond + toponymes.
 */
export function buildMapTilerDarkStyle(key: string) {
  return {
    version: 8 as const,
    name: 'vectracom-maptiler-dark-matter',
    sources: {
      maptiler: {
        type: 'raster' as const,
        tiles: [
          `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${key}`,
        ],
        tileSize: 512,
        attribution: '© MapTiler © OpenStreetMap',
        maxzoom: 22,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background' as const,
        paint: { 'background-color': '#0b1220' },
      },
      { id: 'maptiler', type: 'raster' as const, source: 'maptiler' },
    ],
  };
}

export const MAP_STYLE_FALLBACK = {
  version: 8 as const,
  name: 'vectracom-osm',
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': '#0b1220' },
    },
    { id: 'osm', type: 'raster' as const, source: 'osm' },
  ],
};

export function getMapStyle(): object {
  if (MAPTILER_KEY) return buildMapTilerDarkStyle(MAPTILER_KEY);
  return MAP_STYLE_FALLBACK;
}

/** Style actif au chargement du module. */
export const MAP_STYLE = getMapStyle();

export const MAP_DARK_STYLE = MAP_STYLE;
export const MAP_DARK_RASTER_FALLBACK = MAP_STYLE_FALLBACK;

export const MAP_HAS_MAPTILER = Boolean(MAPTILER_KEY);

/** No-op pour raster (libellés déjà dans les tuiles). */
export function enhanceDarkLabels(_map: unknown) {
  /* raster MapTiler / OSM */
}

/** Fallback Sénégal (Dakar). */
export const SENEGAL_CENTER: LngLat = [-17.444, 14.693];
export const SENEGAL_ZOOM = 12;
