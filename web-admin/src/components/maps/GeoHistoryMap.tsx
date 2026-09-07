'use client';

import { useEffect, useRef } from 'react';
import type { Map, Marker, GeoJSONSource } from 'maplibre-gl';
import { maplibregl } from './maplibre';
import { MAP_STYLE, SENEGAL_CENTER, SENEGAL_ZOOM, enhanceDarkLabels, fitBoundsFromPoints } from './geo';

export type HistoryPoint = {
  id?: string;
  latitude: number | string;
  longitude: number | string;
  recordedAt?: string;
  nearestZoneName?: string | null;
  insideNearestZone?: boolean;
  source?: string;
};

type Props = {
  positions: HistoryPoint[];
  height?: number;
};

export function GeoHistoryMap({ positions, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE as any,
      center: SENEGAL_CENTER,
      zoom: SENEGAL_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      enhanceDarkLabels(map);
      map.resize();
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const chronologic = [...positions]
      .map((p) => ({
        ...p,
        lat: Number(p.latitude),
        lng: Number(p.longitude),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .sort((a, b) => new Date(a.recordedAt || 0).getTime() - new Date(b.recordedAt || 0).getTime());

    const paint = () => {
      const line: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features:
          chronologic.length >= 2
            ? [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: chronologic.map((p) => [p.lng, p.lat]),
                  },
                },
              ]
            : [],
      };

      if (map.getSource('track')) {
        (map.getSource('track') as GeoJSONSource).setData(line);
      } else if (map.isStyleLoaded()) {
        map.addSource('track', { type: 'geojson', data: line });
        map.addLayer({
          id: 'track-line',
          type: 'line',
          source: 'track',
          paint: {
            'line-color': '#0f9d70',
            'line-width': 3,
            'line-opacity': 0.85,
          },
        });
      }

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      chronologic.forEach((p, i) => {
        const isLast = i === chronologic.length - 1;
        const el = document.createElement('div');
        el.style.cssText = [
          `width:${isLast ? 12 : 7}px`,
          `height:${isLast ? 12 : 7}px`,
          'border-radius:999px',
          `background:${isLast ? '#0f9d70' : '#7a8f80'}`,
          'border:2px solid #0a0f0d',
        ].join(';');
        const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        markersRef.current.push(marker);
      });

      const b = fitBoundsFromPoints(
        chronologic.map((p) => ({ lat: p.lat, lng: p.lng })),
        chronologic.length === 1 ? 0.03 : 0.005,
      );
      if (b) {
        map.fitBounds(new maplibregl.LngLatBounds(b[0], b[1]), { padding: 40, maxZoom: 15, duration: 500 });
      }
      map.resize();
    };

    if (map.isStyleLoaded()) paint();
    else map.once('load', paint);
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-[#1e2e25] bg-[#0a0f0d] text-xs text-[#7a8f80]/70"
        style={{ height }}
      >
        Aucun point sur la période.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#1e2e25]">
      <div ref={containerRef} style={{ height, width: '100%', background: '#0a0f0d' }} />
    </div>
  );
}
