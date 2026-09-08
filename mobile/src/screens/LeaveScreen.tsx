import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { createLeaveMe, LeaveRequest, listMyLeaves } from '../services/hr';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function LeaveScreen() {
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(plusDays(1));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<LeaveRequest[]>([]);

  const reload = async () => {
    try {
      setMine(await listMyLeaves());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const submit = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Dates', 'Début et fin requis (AAAA-MM-JJ)');
      return;
    }
    setSaving(true);
    try {
      await createLeaveMe({
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      Alert.alert('Demande envoyée', 'Statut : en attente de validation');
      setReason('');
      await reload();
    } catch (e: any) {
      Alert.alert('Congé', e?.message || 'Échec');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Congé rapide" subtitle="Demande en quelques secondes">
      <Card style={styles.card}>
        <Input label="Début (AAAA-MM-JJ)" value={startDate} onChangeText={setStartDate} />
        <Input label="Fin (AAAA-MM-JJ)" value={endDate} onChangeText={setEndDate} />
        <Input
          label="Motif (optionnel)"
          value={reason}
          onChangeText={setReason}
          placeholder="Ex. congé annuel"
        />
      </Card>
      <Button loading={saving} onPress={submit}>
        Envoyer la demande
      </Button>

      {mine.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.head}>Mes demandes</Text>
          {mine.slice(0, 5).map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.meta}>
                {l.startDate} → {l.endDate}
              </Text>
              <Text style={styles.status}>{l.status}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { fontSize: 13, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meta: { fontSize: 12, color: colors.muted, flex: 1 },
  status: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
