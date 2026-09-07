import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Card, EmptyState, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { listMyStock } from '../services/ops';

export function StockScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listMyStock()
      .then((d) => setItems(Array.isArray(d) ? d.slice(0, 40) : []))
      .catch((e: any) => {
        setItems([]);
        setError(e?.message || 'Impossible de charger le stock');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Stock" subtitle="Références disponibles">
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : error ? (
        <EmptyState title="Stock indisponible" description={error} />
      ) : items.length === 0 ? (
        <EmptyState title="Aucun article" description="Le stock se synchronise depuis le dépôt." />
      ) : (
        items.map((it) => (
          <Card key={it.id} style={styles.card}>
            <Text style={styles.ref}>{it.reference}</Text>
            <Text style={styles.name} numberOfLines={1}>{it.designation}</Text>
            <Text style={styles.meta}>{it.family} · {it.category}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, gap: 2, paddingVertical: 12 },
  ref: { fontSize: 12, fontFamily: 'monospace', color: colors.primary },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11, color: colors.muted },
});
