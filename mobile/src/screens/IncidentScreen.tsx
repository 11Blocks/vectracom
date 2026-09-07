import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Button, Card, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { createIncident } from '../services/ops';
import { enqueue, flushQueue } from '../offline/queue';

export function IncidentScreen() {
  const route = useRoute<any>();
  const [zone, setZone] = useState(route.params?.zone || '');
  const [note, setNote] = useState('');
  const [rubrique, setRubrique] = useState('PBO');
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);

  const captureGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('GPS', 'Permission refusée');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  };

  const submit = async () => {
    if (!zone.trim()) {
      Alert.alert('Zone requise');
      return;
    }
    setLoading(true);
    const payload = {
      rubrique,
      zone: zone.trim(),
      gpsLatitude: gps?.lat,
      gpsLongitude: gps?.lon,
      annotationOriginale: note || undefined,
    };
    try {
      try {
        await createIncident(payload);
        Alert.alert('Incident créé');
      } catch {
        await enqueue({ method: 'POST', path: '/incidents', body: payload });
        flushQueue().catch(() => undefined);
        Alert.alert('Hors-ligne', 'Incident mis en file — sync auto.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Incident GPS" subtitle="Signalement terrain">
      <Card style={styles.card}>
        <Input label="Rubrique" value={rubrique} onChangeText={setRubrique} placeholder="PBO / PIO / CHAMBRE" />
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
});
