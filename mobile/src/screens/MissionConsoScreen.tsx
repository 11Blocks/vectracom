import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Button, Card, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { saveMissionMaterials } from '../services/missions';

type Line = { designation: string; quantity: string };

export function MissionConsoScreen() {
  const route = useRoute<any>();
  const missionId = route.params?.id as string;
  const [lines, setLines] = useState<Line[]>([
    { designation: '', quantity: '1' },
    { designation: '', quantity: '1' },
  ]);
  const [saving, setSaving] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const submit = async () => {
    const materialsConsumed = lines
      .map((l, i) => ({
        itemNumber: i + 1,
        designation: l.designation.trim(),
        quantity: Number(l.quantity.replace(',', '.')),
      }))
      .filter((l) => l.designation && Number.isFinite(l.quantity) && l.quantity > 0);

    if (materialsConsumed.length === 0) {
      Alert.alert('Conso', 'Ajoutez au moins une ligne (désignation + quantité)');
      return;
    }

    setSaving(true);
    try {
      await saveMissionMaterials(missionId, materialsConsumed);
      Alert.alert('OK', `${materialsConsumed.length} ligne(s) enregistrée(s)`);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Conso matériel" subtitle="Bordereau mission">
      <Card style={styles.card}>
        {lines.map((l, i) => (
          <View key={i} style={styles.line}>
            <Input
              label={`Ligne ${i + 1} — désignation`}
              value={l.designation}
              onChangeText={(t) => setLine(i, { designation: t })}
              placeholder="Ex. Connecteur SC/APC"
            />
            <Input
              label="Qté"
              keyboardType="decimal-pad"
              value={l.quantity}
              onChangeText={(t) => setLine(i, { quantity: t })}
            />
          </View>
        ))}
        <Pressable onPress={() => setLines((p) => [...p, { designation: '', quantity: '1' }])}>
          <Text style={styles.add}>+ Ajouter une ligne</Text>
        </Pressable>
      </Card>
      <Button loading={saving} onPress={submit}>
        Enregistrer la conso
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  line: { gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  add: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
