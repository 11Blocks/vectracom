import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Badge, Button, EmptyState, Input, ListRow, Screen, SkeletonCard } from '../components/ui';
import { spacing } from '../theme/colors';
import { getLowStock, listMyStock, StockItem } from '../services/ops';

const DISPLAY_LIMIT = 40;

export function StockScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [lowCount, setLowCount] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, low] = await Promise.all([listMyStock(), getLowStock().catch(() => [])]);
      const all = Array.isArray(d) ? d : [];
      setTotal(all.length);
      setItems(all);
      setLowCount(Array.isArray(low) ? low.length : 0);
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      setError(e?.message || 'Impossible de charger le stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? items
      : items.filter(
          (it) =>
            it.reference?.toLowerCase().includes(q) ||
            it.designation?.toLowerCase().includes(q) ||
            it.family?.toLowerCase().includes(q) ||
            it.category?.toLowerCase().includes(q),
        );
    return base.slice(0, DISPLAY_LIMIT);
  }, [items, query]);

  const truncated = !query.trim() && total > DISPLAY_LIMIT;

  return (
    <Screen
      title="Stock"
      subtitle={
        error
          ? 'Erreur de chargement'
          : truncated
            ? `${filtered.length} / ${total} (recherchez pour affiner)`
            : `${filtered.length} référence(s)`
      }
      refreshing={loading}
      onRefresh={load}
      right={lowCount > 0 ? <Badge tone="warning">Bas {lowCount}</Badge> : undefined}
    >
      <Button onPress={() => nav.navigate('StockScan')}>Scanner QR / série</Button>
      <Input
        placeholder="Rechercher référence, désignation…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {loading && items.length === 0 ? (
        <View style={{ gap: spacing.sm, marginTop: 8 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <EmptyState title="Stock indisponible" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? 'Aucun résultat' : 'Aucun article'}
          description={query ? 'Modifiez la recherche.' : 'Le stock se synchronise depuis le dépôt.'}
        />
      ) : (
        filtered.map((it) => (
          <ListRow
            key={it.id}
            title={it.designation || '—'}
            mono={it.reference}
            subtitle={[it.family, it.category].filter(Boolean).join(' · ') || undefined}
            onPress={() => nav.navigate('StockDetail', { id: it.id })}
          />
        ))
      )}
    </Screen>
  );
}
