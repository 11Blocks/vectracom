import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { saveAttendance } from '../services/ops';
import { enqueue, flushQueue } from '../offline/queue';

const DAYS = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mer' },
  { key: 'thursday', label: 'Jeu' },
  { key: 'friday', label: 'Ven' },
  { key: 'saturday', label: 'Sam' },
  { key: 'sunday', label: 'Dim' },
] as const;

function mondayOf(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export function PresenceScreen() {
  const [days, setDays] = useState<Record<string, boolean>>({
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false,
  });
  const [loading, setLoading] = useState(false);
  const weekStart = mondayOf();

  const submit = async () => {
    setLoading(true);
    const payload = { weekStart, ...days };
    try {
      try {
        await saveAttendance(payload);
        Alert.alert('Présence enregistrée', `Semaine du ${weekStart}`);
      } catch (e: any) {
        const msg = e?.message || '';
        // Erreur métier (pas de technicien) → ne pas mettre en file
        if (/technicien/i.test(msg)) {
          Alert.alert('Présence', msg);
          return;
        }
        await enqueue({ method: 'POST', path: '/attendance/me', body: payload });
        flushQueue().catch(() => undefined);
        Alert.alert('Hors-ligne', 'Présence en file de sync.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Présence" subtitle={`Semaine du ${weekStart}`}>
      <Card style={styles.card}>
        {DAYS.map((d) => (
          <View key={d.key} style={styles.row}>
            <Text style={styles.label}>{d.label}</Text>
            <Switch
              value={!!days[d.key]}
              onValueChange={(v) => setDays((prev) => ({ ...prev, [d.key]: v }))}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        ))}
        <Button loading={loading} onPress={submit}>Valider la feuille</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  label: { color: colors.text, fontSize: 14, fontWeight: '500' },
});
