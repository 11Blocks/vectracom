'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type AiStatus = { gemini: boolean; yolo: boolean; mode: 'ia' | 'regles' };
let cached: Promise<AiStatus | null> | null = null;

function loadStatus() {
  cached ??= (api.get('/ai/status') as Promise<AiStatus>).catch(() => null);
  return cached;
}

/** Indique honnêtement quand les « analyses IA » viennent de règles simples (aucun moteur configuré). */
export function AiModeBadge() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => { let alive = true; loadStatus().then(s => { if (alive) setStatus(s); }); return () => { alive = false; }; }, []);
  if (!status || status.mode === 'ia') return null;
  return (
    <span title="Aucun moteur d'IA n'est configuré (clé Gemini / serveur YOLO) : ces résultats sont produits par des règles déterministes."
      className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-[#7a8f80]/40 text-[#7a8f80]">
      Mode règles — sans moteur IA
    </span>
  );
}
