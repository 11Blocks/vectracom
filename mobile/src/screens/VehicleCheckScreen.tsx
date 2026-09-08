import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Button, Card, Chip, Input, Screen, useToast } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { createVehicleCheck, listVehicles, Vehicle } from '../services/vehicles';

const CHECKS: Array<{ key: keyof typeof defaults; label: string }> = [
  { key: 'huile', label: 'Huile' },
  { key: 'eau', label: 'Eau' },
  { key: 'freins', label: 'Freins' },
  { key: 'pneus', label: 'Pneus' },
  { key: 'batterie', label: 'Batterie' },
  { key: 'eclairage', label: 'Éclairage' },
];

const defaults = {
  huile: true,
  eau: true,
  freins: true,
  pneus: true,
  batterie: true,
  eclairage: true,
};

export function VehicleCheckScreen() {
  const route = useRoute<any>();
  const { toast } = useToast();
  const missionId = route.params?.missionId as string | undefined;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [checks, setChecks] = useState(defaults);
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listVehicles();
        setVehicles(rows);
        if (rows[0]) setVehicleId(rows[0].id);
      } catch (e: any) {
        toast({ title: 'Véhicules', description: e?.message || 'Chargement impossible', variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const submit = async () => {
    if (!vehicleId) {
      toast({ title: 'Aucun véhicule disponible', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await createVehicleCheck(vehicleId, {
        ...checks,
        missionId,
        observations: observations.trim() || undefined,
      });
      toast({ title: 'Checklist enregistrée', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Enregistrement refusé', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Checklist véhicule" subtitle="Contrôle ~15 s">
      <Card style={styles.card}>
        <Text style={styles.label}>Véhicule</Text>
        {loading ? (
          <Text style={styles.meta}>Chargement…</Text>
        ) : vehicles.length === 0 ? (
          <Text style={styles.meta}>Aucun véhicule — créer côté web-admin.</Text>
        ) : (
          <View style={styles.chips}>
            {vehicles.map((v) => (
              <Chip
                key={v.id}
                label={v.immatriculation || v.modele || v.id.slice(0, 8)}
                selected={vehicleId === v.id}
                onPress={() => setVehicleId(v.id)}
              />
            ))}
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        {CHECKS.map((c) => (
          <View key={c.key} style={styles.row}>
            <Text style={styles.checkLabel}>{c.label}</Text>
            <Switch
              value={checks[c.key]}
              onValueChange={(v) => setChecks((prev) => ({ ...prev, [c.key]: v }))}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        ))}
        <Input
          label="Observations"
          value={observations}
          onChangeText={setObservations}
          placeholder="Optionnel"
        />
      </Card>

      <Button loading={saving} onPress={submit} disabled={!vehicleId}>
        Valider la checklist
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkLabel: { fontSize: 14, color: colors.text },
});
