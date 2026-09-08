import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import {
  getStockItem,
  getStockLevels,
  getStockSerials,
  SerialSearchHit,
  StockItem,
  StockLevel,
  StockSerial,
} from '../services/ops';

export function StockDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const id = route.params?.id as string;
  const [item, setItem] = useState<StockItem | null>(null);
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [serials, setSerials] = useState<StockSerial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Article introuvable');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const it = await getStockItem(id);
        setItem(it);
        const [lv, ser] = await Promise.all([
          getStockLevels(id).catch(() => [] as StockLevel[]),
          it.category === 'ASSET'
            ? getStockSerials(id).catch(() => [] as StockSerial[])
            : Promise.resolve([] as StockSerial[]),
        ]);
        setLevels(Array.isArray(lv) ? lv : []);
        setSerials(Array.isArray(ser) ? ser : []);
      } catch (e: any) {
        setItem(null);
        setError(e?.message ?? 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Screen title="Article">
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen title="Article">
        <EmptyState title="Introuvable" description={error || 'Cet article n’existe pas.'} />
      </Screen>
    );
  }

  const totalQty = levels.reduce((sum, l) => sum + Number(l.quantity || 0), 0);

  return (
    <Screen title={item.reference} subtitle={item.designation}>
      <Card style={styles.card}>
        <Row label="Référence" value={item.reference} mono />
        <Row label="Désignation" value={item.designation} />
        <View style={styles.row}>
          <Text style={styles.label}>Catégorie / Famille</Text>
          <View style={styles.badges}>
            <Badge>{item.category || '—'}</Badge>
            <Badge tone="info">{item.family || '—'}</Badge>
          </View>
        </View>
        <Row label="Unité" value={item.unit || '—'} />
        <Row label="Seuil d’alerte" value={String(item.thresholdAlert ?? '—')} />
        {item.category === 'CONSUMABLE' && (
          <Row label="Quantité totale" value={String(totalQty)} />
        )}
      </Card>

      {item.category === 'CONSUMABLE' && (
        <Button
          onPress={() =>
            nav.navigate('StockMove', { stockItemId: item.id, designation: item.designation })
          }
        >
          Mouvement stock
        </Button>
      )}

      {item.category === 'ASSET' && (
        <Button onPress={() => nav.navigate('StockScan')}>Scanner QR / série</Button>
      )}

      {item.category === 'CONSUMABLE' && (
        <Card style={styles.card}>
          <Text style={styles.section}>Niveaux par dépôt</Text>
          {levels.length === 0 ? (
            <Text style={styles.empty}>Aucun niveau enregistré.</Text>
          ) : (
            levels.map((l) => (
              <View key={l.id} style={styles.levelRow}>
                <Text style={styles.levelName} numberOfLines={1}>
                  {l.warehouse?.name || l.warehouse?.code || 'Dépôt'}
                </Text>
                <Text style={styles.levelQty}>{l.quantity}</Text>
              </View>
            ))
          )}
        </Card>
      )}

      {item.category === 'ASSET' && (
        <Card style={styles.card}>
          <Text style={styles.section}>Numéros de série ({serials.length})</Text>
          {serials.length === 0 ? (
            <Text style={styles.empty}>Aucun numéro de série.</Text>
          ) : (
            serials.slice(0, 30).map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  const hit: SerialSearchHit = {
                    id: s.id,
                    serialNumber: s.serialNumber,
                    status: s.status || '—',
                    reference: item.reference,
                    designation: item.designation,
                  };
                  nav.navigate('SerialDetail', { serial: hit });
                }}
                style={({ pressed }) => [styles.levelRow, pressed && styles.serialPressed]}
              >
                <Text style={styles.serial} numberOfLines={1}>
                  {s.serialNumber}
                </Text>
                <Badge tone={s.status === 'disponible' ? 'success' : 'neutral'}>
                  {s.status || '—'}
                </Badge>
              </Pressable>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  row: { gap: 2 },
  label: { fontSize: 11, color: colors.muted },
  value: { fontSize: 14, color: colors.text, fontWeight: '500' },
  mono: { fontFamily: 'monospace', color: colors.primary },
  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  section: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 },
  empty: { fontSize: 12, color: colors.muted },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  levelName: { flex: 1, fontSize: 13, color: colors.text },
  levelQty: { fontSize: 14, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },
  serial: { flex: 1, fontSize: 12, fontFamily: 'monospace', color: colors.primary },
  serialPressed: { opacity: 0.7, backgroundColor: colors.accent },
});
