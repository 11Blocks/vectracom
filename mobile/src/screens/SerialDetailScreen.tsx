import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Badge, Button, Card, Chip, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import {
  deliverSerial,
  installSerial,
  listTeams,
  returnSerial,
  SerialSearchHit,
  Team,
} from '../services/ops';

export function SerialDetailScreen() {
  const route = useRoute<any>();
  const initial = route.params?.serial as SerialSearchHit;
  const alternatives = (route.params?.alternatives as SerialSearchHit[] | undefined) || [];
  const missionId = route.params?.missionId as string | undefined;
  const [serial, setSerial] = useState(initial);
  const [nd, setNd] = useState(initial?.clientNd || '');
  const [defect, setDefect] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    listTeams()
      .then((t) => setTeams(Array.isArray(t) ? t : []))
      .catch(() => setTeams([]));
  }, []);

  if (!serial) {
    return (
      <Screen title="Série">
        <Text style={{ color: colors.danger }}>Série introuvable</Text>
      </Screen>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setLoading(key);
    try {
      await fn();
      Alert.alert('OK', ok);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Échec');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Screen title={serial.serialNumber} subtitle={`${serial.reference} · ${serial.designation}`}>
      <Card style={styles.card}>
        <Row label="Statut" value={serial.status || '—'} />
        <Row label="ND client" value={serial.clientNd || '—'} />
        <Row label="Installé le" value={serial.installedAt || '—'} />
        <Badge>{serial.reference}</Badge>
      </Card>

      {alternatives.length > 1 && (
        <Card style={styles.card}>
          <Text style={styles.section}>Autres résultats ({alternatives.length})</Text>
          {alternatives.map((a) => (
            <Pressable key={a.id} onPress={() => setSerial(a)} style={styles.altRow}>
              <Text style={[styles.altText, a.id === serial.id && styles.altActive]}>
                {a.serialNumber} · {a.status}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.section}>Livrer à une équipe</Text>
        <View style={styles.chips}>
          {teams.slice(0, 12).map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              selected={teamId === t.id}
              onPress={() => setTeamId(t.id)}
            />
          ))}
        </View>
        <Button
          loading={loading === 'deliver'}
          disabled={!teamId}
          onPress={() =>
            teamId &&
            run('deliver', () => deliverSerial(serial.id, teamId), 'Série livrée à l’équipe')
          }
        >
          Livrer
        </Button>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Installer chez le client</Text>
        {missionId ? (
          <Text style={styles.missionHint}>Mission liée : {missionId.slice(0, 8)}…</Text>
        ) : (
          <Text style={styles.missionHint}>Sans mission (scan libre)</Text>
        )}
        <Input label="ND client *" value={nd} onChangeText={setNd} autoCapitalize="characters" />
        <Button
          loading={loading === 'install'}
          onPress={() => {
            if (!nd.trim()) {
              Alert.alert('ND requis');
              return;
            }
            run(
              'install',
              () => installSerial(serial.id, nd.trim(), missionId),
              missionId ? 'Installation enregistrée (mission liée)' : 'Installation enregistrée',
            );
          }}
        >
          Installer
        </Button>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Retour terrain</Text>
        <View style={styles.rowSwitch}>
          <Text style={styles.label}>Défectueux</Text>
          <Switch
            value={defect}
            onValueChange={setDefect}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <Button
          variant="outline"
          loading={loading === 'return'}
          onPress={() =>
            run('return', () => returnSerial(serial.id, defect), 'Retour enregistré')
          }
        >
          Retour dépôt
        </Button>
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  row: { gap: 2 },
  label: { fontSize: 11, color: colors.muted },
  value: { fontSize: 14, color: colors.text, fontWeight: '500' },
  section: { fontSize: 13, fontWeight: '600', color: colors.text },
  missionHint: { fontSize: 11, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  altRow: { paddingVertical: 6 },
  altText: { fontSize: 12, color: colors.muted, fontFamily: 'monospace' },
  altActive: { color: colors.primary, fontWeight: '700' },
});
