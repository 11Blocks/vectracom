import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Button, Card, ChipGroup, Input, Screen, useToast } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { createIncident } from '../services/ops';
import { enqueue, flushQueue } from '../offline/queue';

const RUBRIQUES = ['PBO', 'PIO', 'CHAMBRE'] as const;

export function IncidentScreen() {
  const route = useRoute<any>();
  const { toast } = useToast();
  const missionId = route.params?.missionId as string | undefined;
  const [zone, setZone] = useState(route.params?.zone || '');
  const [note, setNote] = useState('');
  const [rubrique, setRubrique] = useState<(typeof RUBRIQUES)[number]>('PBO');
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);

  const captureGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      toast({ title: 'GPS', description: 'Permission refusée', variant: 'warning' });
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  };

  const submit = async () => {
    if (!zone.trim()) {
      toast({ title: 'Zone requise', variant: 'warning' });
      return;
    }
    setLoading(true);
    const payload = {
      rubrique,
      zone: zone.trim(),
      source: 'MOBILE',
      gpsLatitude: gps?.lat,
      gpsLongitude: gps?.lon,
      annotationOriginale: note || undefined,
      relatedMissionIds: missionId ? [missionId] : undefined,
    };
    try {
      try {
        await createIncident(payload);
        toast({ title: 'Incident créé', variant: 'success' });
      } catch {
        await enqueue({ method: 'POST', path: '/incidents', body: payload });
        flushQueue().catch(() => undefined);
        toast({ title: 'Hors-ligne', description: 'Incident en file — sync auto', variant: 'info' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Incident GPS" subtitle={missionId ? 'Lié à la mission' : 'Signalement terrain'}>
      <Card style={styles.card}>
        <Text style={styles.label}>Rubrique *</Text>
        <ChipGroup
          options={[...RUBRIQUES]}
          value={rubrique}
          onChange={(v) => setRubrique(v as (typeof RUBRIQUES)[number])}
        />
        <Input label="Zone *" value={zone} onChangeText={setZone} />
        <Input label="Annotation" value={note} onChangeText={setNote} multiline />
        <Button variant="outline" onPress={captureGps}>
          {gps ? `GPS ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'Capturer GPS'}
        </Button>
        <Button loading={loading} onPress={submit}>
          Envoyer
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  label: { fontSize: 12, fontWeight: '500', color: colors.muted },
});
