'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map, Marker, GeoJSONSource } from 'maplibre-gl';
import { maplibregl } from './maplibre';
import {
  MAP_STYLE,
  MAP_STYLE_FALLBACK,
  MAP_HAS_MAPTILER,
  SENEGAL_CENTER,
  SENEGAL_ZOOM,
  circlePolygon,
  enhanceDarkLabels,
  fitBoundsFromPoints,
} from './geo';

const ZONE_COLORS: Record<string, string> = {
  zone_travail: '#0f9d70',
  depot: '#5b8def',
  site_mission: '#f5a623',
};

export type LiveMarker = {
  technicianId: string;
  technicianName: string;
  latitude: number;
  longitude: number;
  minutesAgo?: number;
  outOfZone?: boolean;
  mission?: { clientSite?: string; typeTache?: string; zone?: string | null } | null;
  nearestZoneName?: string | null;
  batteryPct?: number | null;
};

export type LiveZone = {
  id: string;
  name: string;
  type: string;
  centerLatitude: number | string;
  centerLongitude: number | string;
  radiusM: number;
};

type Props = {
  markers: LiveMarker[];
  zones: LiveZone[];
  onSelect?: (m: LiveMarker) => void;
  className?: string;
  height?: number;
};

export function GeoLiveMap({ markers, zones, onSelect, className, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const dataRef = useRef({ markers, zones });
  const onSelectRef = useRef(onSelect);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  dataRef.current = { markers, zones };
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    setMapError(null);

    let cancelled = false;
    let usedFallback = false;
    let map: Map;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE as any,
        center: SENEGAL_CENTER,
        zoom: SENEGAL_ZOOM,
        attributionControl: { compact: true },
      });
    } catch (e: any) {
      setMapError(e?.message || 'Impossible d’initialiser MapLibre');
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    const bump = () => {
      if (!cancelled) {
        enhanceDarkLabels(map);
        map.resize();
        setTick((t) => t + 1);
      }
    };

    map.on('load', bump);
    if (typeof (map as any).loaded === 'function' && (map as any).loaded()) bump();

    map.on('error', (ev) => {
      const msg = (ev as { error?: { message?: string } }).error?.message || '';
      if (!msg || usedFallback) return;
      // Tuile / style MapTiler KO → OSM
      if (!/failed to load|style|401|403|unauthorized|tile|ajax|fetch/i.test(msg)) return;
      try {
        usedFallback = true;
        map.setStyle(MAP_STYLE_FALLBACK as any);
        map.once('load', bump);
      } catch {
        setMapError(msg);
      }
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let attempts = 0;

    const paint = () => {
      if (cancelled || !mapRef.current) return false;
      const mapNow = mapRef.current;

      const { markers: ms, zones: zs } = dataRef.current;

      try {
        const zoneFc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: zs.map((z) => {
            const lat = Number(z.centerLatitude);
            const lng = Number(z.centerLongitude);
            const f = circlePolygon(lng, lat, z.radiusM || 500);
            f.properties = {
              id: z.id,
              name: z.name,
              type: z.type,
              color: ZONE_COLORS[z.type] ?? '#0f9d70',
            };
            return f;
          }),
        };

        if (mapNow.isStyleLoaded()) {
          if (mapNow.getSource('geofences')) {
            (mapNow.getSource('geofences') as GeoJSONSource).setData(zoneFc);
          } else {
            mapNow.addSource('geofences', { type: 'geojson', data: zoneFc });
            mapNow.addLayer({
              id: 'geofences-fill',
              type: 'fill',
              source: 'geofences',
              paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 },
            });
            mapNow.addLayer({
              id: 'geofences-line',
              type: 'line',
              source: 'geofences',
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 1.5,
                'line-dasharray': [2, 1.5],
                'line-opacity': 0.75,
              },
            });
          }
        }
      } catch {
        /* zones optionnelles */
      }

      try {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        const stackCount = new Map<string, number>();

        ms.forEach((m) => {
          const lat = Number(m.latitude);
          const lng = Number(m.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          // Décalage léger si plusieurs tech partagent la même position
          const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
          const stack = stackCount.get(key) || 0;
          stackCount.set(key, stack + 1);
          const jitter = stack * 0.00018;

          const color = m.outOfZone ? '#C0392B' : m.mission ? '#0f9d70' : '#7a8f80';
          const initials = (m.technicianName || '?')
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          const firstName = (m.technicianName || '').split(' ')[0] || '';

          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'vectra-geo-marker';
          el.style.cssText =
            'display:flex;flex-direction:column;align-items:center;gap:2px;background:transparent;border:none;cursor:pointer;padding:0;z-index:2;';
          el.innerHTML = `<span style="
            width:28px;height:28px;border-radius:999px;border:2px solid ${color};
            background:#0a0f0d;color:${color};font:700 10px/28px system-ui,sans-serif;
            text-align:center;display:block;
            box-shadow:0 0 0 4px ${m.outOfZone ? 'rgba(192,57,43,0.2)' : 'rgba(15,157,112,0.15)'};
          ">${escapeHtml(initials)}</span>
          <span style="
            font:600 10px/1.2 system-ui,sans-serif;color:#0a0f0d;
            background:rgba(255,255,255,0.92);padding:2px 5px;border-radius:4px;
            max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
            box-shadow:0 1px 2px rgba(0,0,0,0.35);
          ">${escapeHtml(firstName)}</span>`;
          el.title = m.technicianName || '';

          const popup = new maplibregl.Popup({ offset: 16, closeButton: false, maxWidth: '240px' }).setHTML(
            `<div style="font:12px/1.4 system-ui,sans-serif;color:#e8ede9">
              <strong>${escapeHtml(m.technicianName || '')}</strong><br/>
              ${m.mission ? escapeHtml(m.mission.typeTache || '') + ' — ' + escapeHtml(m.mission.clientSite || '') : 'Hors mission'}
              ${m.nearestZoneName ? '<br/>Zone : ' + escapeHtml(m.nearestZoneName) : ''}
              ${m.mission?.zone ? '<br/>Ops : ' + escapeHtml(m.mission.zone) : ''}
              <br/><span style="color:#7a8f80">il y a ${m.minutesAgo ?? 0} min</span>
            </div>`,
          );

          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lng + jitter, lat + jitter])
            .setPopup(popup)
            .addTo(mapNow);

          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            onSelectRef.current?.(m);
          });

          markersRef.current.push(marker);
        });

        const pts = [
          ...ms.map((m) => ({ lat: Number(m.latitude), lng: Number(m.longitude) })),
          ...zs.map((z) => ({ lat: Number(z.centerLatitude), lng: Number(z.centerLongitude) })),
        ].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

        const b = fitBoundsFromPoints(pts, pts.length === 1 ? 0.03 : 0.008);
        if (b) {
          mapNow.fitBounds(new maplibregl.LngLatBounds(b[0], b[1]), { padding: 48, maxZoom: 14, duration: 600 });
        } else {
          mapNow.jumpTo({ center: SENEGAL_CENTER, zoom: SENEGAL_ZOOM });
        }
        mapNow.resize();
        return markersRef.current.length > 0 || ms.length === 0;
      } catch (err: any) {
        setMapError(err?.message || 'Erreur markers');
        return false;
      }
    };

    if (paint()) {
      return () => {
        cancelled = true;
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
      };
    }

    const onReady = () => {
      paint();
    };
    map.once('load', onReady);
    map.once('idle', onReady);

    const iv = window.setInterval(() => {
      attempts += 1;
      if (paint() || attempts > 40) window.clearInterval(iv);
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      map.off('load', onReady);
      map.off('idle', onReady);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [markers, zones, tick]);

  return (
    <div className={'relative overflow-hidden rounded-lg border border-[#1e2e25] ' + (className ?? '')}>
      <div ref={containerRef} style={{ height, width: '100%', background: '#dce3dc' }} />
      {mapError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f0d]/90 px-4 text-center text-xs text-[#C0392B]">
          Carte indisponible : {mapError}
        </div>
      ) : null}
      {markers.length === 0 && zones.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full border border-[#1e2e25] bg-[#0a0f0d]/90 px-3 py-1 text-[10px] text-[#7a8f80]">
            Carte Dakar — aucun point / zone pour l’instant
          </span>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 text-[10px]">
        <span className="flex items-center gap-1 rounded-full border border-[#1e2e25] bg-[#0a0f0d]/90 px-2 py-1 text-[#0f9d70]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0f9d70]" /> en mission
        </span>
        <span className="flex items-center gap-1 rounded-full border border-[#1e2e25] bg-[#0a0f0d]/90 px-2 py-1 text-[#C0392B]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C0392B]" /> hors zone
        </span>
        <span className="flex items-center gap-1 rounded-full border border-[#1e2e25] bg-[#0a0f0d]/90 px-2 py-1 text-[#7a8f80]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7a8f80]" /> hors mission
        </span>
        <span className="rounded-full border border-[#1e2e25] bg-[#0a0f0d]/90 px-2 py-1 text-[#7a8f80]">
          {MAP_HAS_MAPTILER ? 'Dark Matter · MapTiler' : 'MapLibre · OSM'}
        </span>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
