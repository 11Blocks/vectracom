import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Badge, EmptyState, ListRow, Screen, SkeletonCard } from '../components/ui';
import { colors, spacing, statusTone as mapStatusTone } from '../theme/colors';
import { listMissions, Mission } from '../services/missions';
import { flushQueue, getAllMissionSyncStates, MissionSyncState, pendingCount } from '../offline/queue';

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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await flushQueue().catch(() => undefined);
      const [list, sync, count] = await Promise.all([
        listMissions(),
        getAllMissionSyncStates(),
        pendingCount(),
      ]);
      setMissions(Array.isArray(list) ? list : []);
      setSyncMap(sync);
      setPending(count);
    } catch (e: any) {
      setMissions([]);
      setError(e?.message || 'Impossible de charger les missions');
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
      subtitle={
        error
          ? 'Erreur de chargement'
          : pending > 0
            ? `${pending} en file d'attente`
            : `${missions.length} mission(s)`
      }
      refreshing={loading}
      onRefresh={load}
      right={
        pending > 0 ? (
          <Pressable onPress={() => flushQueue().then(load)}>
            <Badge tone="warning">Sync {pending}</Badge>
          </Pressable>
        ) : null
      }
    >
      {loading && missions.length === 0 ? (
        <View style={{ gap: spacing.sm, marginTop: 8 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <EmptyState title="Missions indisponibles" description={error} />
      ) : missions.length === 0 ? (
        <EmptyState
          title="Aucune mission"
          description="Importez le planning SONATEL depuis le web-admin."
        />
      ) : (
        missions.map((m) => (
          <ListRow
            key={m.id}
            title={m.clientSite || '—'}
            mono={m.sonatelDossierNumber || undefined}
            subtitle={m.typeTache || undefined}
            meta={[
              m.zone,
              m.importMeta?.heureDebut || m.importMeta?.heureFin
                ? `${m.importMeta?.heureDebut || '?'}–${m.importMeta?.heureFin || '?'}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            trailing={
              <View style={styles.badges}>
                {syncBadge(syncMap[m.id])}
                <Badge tone={mapStatusTone(m.status)}>{m.status || '—'}</Badge>
              </View>
            }
            onPress={() => nav.navigate('MissionDetail', { id: m.id })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: 4, flexShrink: 0 },
});
