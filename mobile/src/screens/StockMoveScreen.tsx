import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Button, Card, Chip, ChipGroup, Input, Screen, useToast } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { createStockMovement, listWarehouses, Warehouse } from '../services/ops';

const TYPE_LABELS = ['Entrée', 'Sortie / conso', 'Transfert'] as const;
const TYPE_KEYS = ['entree', 'consommation', 'transfert'] as const;

export function StockMoveScreen() {
  const route = useRoute<any>();
  const { toast } = useToast();
  const stockItemId = route.params?.stockItemId as string;
  const designation = route.params?.designation as string | undefined;
  const [typeLabel, setTypeLabel] = useState<(typeof TYPE_LABELS)[number]>('Entrée');
  const type = TYPE_KEYS[TYPE_LABELS.indexOf(typeLabel)] || 'entree';
  const [qty, setQty] = useState('1');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listWarehouses()
      .then((w) => setWarehouses(Array.isArray(w) ? w : []))
      .catch(() => setWarehouses([]));
  }, []);

  const submit = async () => {
    const quantity = Number(qty);
    if (!stockItemId) {
      toast({ title: 'Article manquant', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast({ title: 'Quantité invalide', variant: 'warning' });
      return;
    }
    if (type === 'entree' && !toId) {
      toast({ title: 'Choisir le dépôt destination', variant: 'warning' });
      return;
    }
    if (type === 'consommation' && !fromId) {
      toast({ title: 'Choisir le dépôt source', variant: 'warning' });
      return;
    }
    if (type === 'transfert' && (!fromId || !toId)) {
      toast({ title: 'Source et destination requises', variant: 'warning' });
      return;
    }
    setLoading(true);
    try {
      await createStockMovement({
        stockItemId,
        type,
        quantity,
        fromWarehouseId: type === 'entree' ? null : fromId,
        toWarehouseId: type === 'consommation' ? null : toId,
        note: note.trim() || undefined,
      });
      toast({ title: 'Mouvement enregistré', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Échec', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Mouvement" subtitle={designation || 'Stock consommable'}>
      <Card style={styles.card}>
        <Text style={styles.label}>Type</Text>
        <ChipGroup
          options={[...TYPE_LABELS]}
          value={typeLabel}
          onChange={(v) => setTypeLabel(v as (typeof TYPE_LABELS)[number])}
        />
        <Input label="Quantité *" value={qty} onChangeText={setQty} keyboardType="number-pad" />
        {(type === 'consommation' || type === 'transfert') && (
          <WarehousePicker label="Source *" warehouses={warehouses} selected={fromId} onSelect={setFromId} />
        )}
        {(type === 'entree' || type === 'transfert') && (
          <WarehousePicker
            label="Destination *"
            warehouses={warehouses}
            selected={toId}
            onSelect={setToId}
          />
        )}
        <Input label="Note" value={note} onChangeText={setNote} />
        <Button loading={loading} onPress={submit}>
          Valider
        </Button>
      </Card>
    </Screen>
  );
}

function WarehousePicker({
  label,
  warehouses,
  selected,
  onSelect,
}: {
  label: string;
  warehouses: Warehouse[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {warehouses.slice(0, 16).map((w) => (
          <Chip
            key={w.id}
            label={w.name}
            selected={selected === w.id}
            onPress={() => onSelect(w.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  label: { fontSize: 12, fontWeight: '500', color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
