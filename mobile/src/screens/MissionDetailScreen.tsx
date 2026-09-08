import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Badge, Button, Card, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { getMission, Mission, resolveTemplateKey, updateMissionStatus } from '../services/missions';
import { getMissionSyncState, MissionSyncState } from '../offline/queue';
import { chatRoomForMission } from '../services/chat';

export function MissionDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const id = route.params?.id as string;
  const [mission, setMission] = useState<Mission | null>(null);
  const [sync, setSync] = useState<MissionSyncState>('idle');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([getMission(id), getMissionSyncState(id)]);
      setMission(m);
      setSync(s);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [id]);

  const openSalon = async (missionRoom?: boolean) => {
    setOpeningChat(true);
    try {
      const room = await chatRoomForMission(mission!.id, { missionRoom });
      nav.navigate('Conversation', { roomId: room.roomId, title: room.title });
    } catch (e: any) {
      Alert.alert('Salon', e?.message || 'Impossible d’ouvrir le salon');
    } finally {
      setOpeningChat(false);
    }
  };

  const closeMission = () => {
    Alert.alert('Clôturer', 'Passer la mission en « terminee » ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Clôturer',
        style: 'destructive',
        onPress: async () => {
          setClosing(true);
          try {
            let current = mission.status;
            if (current === 'planifiee' || current === 'a_completer') {
              await updateMissionStatus(id, 'en_cours');
              current = 'en_cours';
            }
            const updated = await updateMissionStatus(id, 'terminee');
            setMission(updated);
            Alert.alert('OK', 'Mission clôturée');
          } catch (e: any) {
            Alert.alert('Clôture', e?.message || 'Transition refusée');
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen title="Mission">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!mission) {
    return (
      <Screen title="Mission">
        <Text style={{ color: colors.danger }}>{error || 'Introuvable'}</Text>
      </Screen>
    );
  }

  const templateKey = resolveTemplateKey(mission.typeTache);
  const canClose = mission.status === 'en_cours' || mission.status === 'planifiee' || mission.status === 'a_completer';

  return (
    <Screen title={mission.clientSite || 'Mission'} subtitle={mission.sonatelDossierNumber || undefined}>
      <Card style={styles.card}>
        <Row label="Statut" value={mission.status || '—'} />
        <Row label="Type (typeTache)" value={mission.typeTache || '—'} />
        <Row label="Template" value={templateKey} />
        <Row label="Zone" value={mission.zone || '—'} />
        <Row
          label="Date"
          value={mission.dateMission ? new Date(mission.dateMission).toLocaleDateString('fr-FR') : '—'}
        />
        <View style={styles.syncRow}>
          <Text style={styles.label}>Sync locale</Text>
          {sync === 'pending_sync' && <Badge tone="warning">En attente</Badge>}
          {sync === 'synced' && <Badge tone="success">Synchronisé</Badge>}
          {sync === 'failed' && <Badge tone="danger">Échec</Badge>}
          {sync === 'idle' && <Badge>—</Badge>}
        </View>
      </Card>

      <Button onPress={() => nav.navigate('MissionForm', { id: mission.id })}>
        Ouvrir le formulaire
      </Button>
      <Button variant="outline" onPress={() => nav.navigate('MissionConso', { id: mission.id })}>
        Conso matériel
      </Button>
      <Button
        variant="outline"
        onPress={() => nav.navigate('StockScan', { missionId: mission.id })}
      >
        Scanner QR / série
      </Button>
      {canClose ? (
        <Button variant="secondary" loading={closing} onPress={closeMission}>
          Clôturer la mission
        </Button>
      ) : null}
      <Button variant="outline" onPress={() => nav.navigate('Incident', { missionId: mission.id, zone: mission.zone })}>
        Signaler un incident
      </Button>
      <Button variant="outline" loading={openingChat} onPress={() => openSalon(false)}>
        Salon équipe
      </Button>
      <Button variant="outline" loading={openingChat} onPress={() => openSalon(true)}>
        Salon mission (opt-in)
      </Button>
      <Button
        variant="outline"
        onPress={() => nav.navigate('VehicleCheck', { missionId: mission.id })}
      >
        Checklist véhicule
      </Button>
      <Button variant="outline" onPress={() => nav.navigate('VocalAssist', { missionId: mission.id })}>
        Commande vocale
      </Button>
      <Button variant="secondary" onPress={() => nav.navigate('Expense', { missionId: mission.id })}>
        Dépense rapide
      </Button>
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
  card: { gap: spacing.sm },
  row: { gap: 2 },
  label: { fontSize: 11, color: colors.muted },
  value: { fontSize: 14, color: colors.text, fontWeight: '500' },
  syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
});
