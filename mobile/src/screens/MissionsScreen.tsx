import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Badge, Card, EmptyState, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { listMissions, Mission } from '../services/missions';
import { flushQueue, getAllMissionSyncStates, MissionSyncState, pendingCount } from '../offline/queue';

function statusTone(status?: string) {
  if (status === 'terminee' || status === 'validee') return 'success' as const;
  if (status === 'en_cours') return 'info' as const;
  if (status === 'rejetee') return 'danger' as const;
  return 'neutral' as const;
}

function syncBadge(state?: MissionSyncState) {
  if (state === 'pending_sync') return <Badge tone="warning">Offline</Badge>;
  if (state === 'failed') return <Badge tone="danger">Sync échec</Badge>;
  if (state === 'synced') return <Badge tone="success">Sync OK</Badge>;
  return null;
}

export function MissionsScreen() {
  const nav = useNavigation<any>();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [syncMap, setSyncMap] = useState<Record<string, MissionSyncState>>({});
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await flushQueue();
      const [list, sync, count] = await Promise.all([
        listMissions(),
        getAllMissionSyncStates(),
        pendingCount(),
      ]);
      setMissions(list);
      setSyncMap(sync);
      setPending(count);
    } catch {
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen
      title="Missions"
      subtitle={pending > 0 ? `${pending} en file d'attente` : `${missions.length} mission(s)`}
      right={
        pending > 0 ? (
          <Pressable onPress={() => flushQueue().then(load)}>
            <Badge tone="warning">Sync {pending}</Badge>
          </Pressable>
        ) : null
      }
    >
      {!loading && missions.length === 0 ? (
        <EmptyState title="Aucune mission" description="Importez le planning SONATEL depuis le web-admin." />
      ) : (
        missions.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => nav.navigate('MissionDetail', { id: m.id })}
            style={{ marginBottom: spacing.sm }}
          >
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.client} numberOfLines={1}>{m.clientSite || '—'}</Text>
                <View style={styles.badges}>
                  {syncBadge(syncMap[m.id])}
                  <Badge tone={statusTone(m.status)}>{m.status || '—'}</Badge>
                </View>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                <Text style={styles.mono}>{m.sonatelDossierNumber || '—'}</Text>
                {' · '}{m.typeTache || '—'}
                {m.zone ? ` · ${m.zone}` : ''}
              </Text>
              {(m.importMeta?.heureDebut || m.importMeta?.heureFin) && (
                <Text style={styles.hours}>
                  {m.importMeta.heureDebut || '?'}–{m.importMeta.heureFin || '?'}
                </Text>
              )}
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  client: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  badges: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  meta: { fontSize: 11, color: colors.muted },
  mono: { color: colors.primary, fontFamily: 'monospace' },
  hours: { fontSize: 11, color: colors.muted, fontVariant: ['tabular-nums'] },
});
