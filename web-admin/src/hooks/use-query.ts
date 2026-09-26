'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Hook de requête GET avec rafraîchissement manuel et polling optionnel. */
export function useQuery<T = any>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { pollingMs?: number; immediate?: boolean } = {},
): UseQueryResult<T> {
  const { pollingMs, immediate = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(async () => {
    try {
      setError(null);
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      setLoading(true);
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, immediate, ...deps]);

  useEffect(() => {
    if (!pollingMs) return;
    const interval = setInterval(execute, pollingMs);
    return () => clearInterval(interval);
  }, [pollingMs, execute]);

  return { data, loading, error, refetch: execute };
}

interface UseMutationResult<T> {
  mutate: (...args: any[]) => Promise<T | null>;
  loading: boolean;
  error: string | null;
  data: T | null;
  reset: () => void;
}

/** Hook de mutation (POST/PUT/PATCH/DELETE) avec état de chargement. */
export function useMutation<T = any>(
  mutationFn: (...args: any[]) => Promise<T>,
  options: { onSuccess?: (data: T) => void; onError?: (error: Error) => void } = {},
): UseMutationResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  // `mutate` reste stable, mais doit toujours exécuter la fonction et les callbacks du dernier rendu
  // (sinon l'état du formulaire et les props sont figés à leur valeur initiale).
  const fnRef = useRef(mutationFn);
  const optionsRef = useRef(options);
  fnRef.current = mutationFn;
  optionsRef.current = options;

  const mutate = useCallback(async (...args: any[]): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      setData(result);
      optionsRef.current.onSuccess?.(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      optionsRef.current.onError?.(err instanceof Error ? err : new Error(message));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { mutate, loading, error, data, reset };
}
