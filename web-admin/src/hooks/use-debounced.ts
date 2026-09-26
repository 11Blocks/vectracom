'use client';

import { useEffect, useState } from 'react';

/** Valeur retardée (recherche serveur : une requête après la frappe, pas à chaque touche). */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
