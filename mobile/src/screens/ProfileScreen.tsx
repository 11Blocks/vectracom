import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Button, Card, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { AuthUser, getUser, logout } from '../services/api';
import { pendingCount } from '../offline/queue';
import { isBackgroundTrackingRunning } from '../tracking/background';
import { isTrackingRunning } from '../tracking/foreground';

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const nav = useNavigation<any>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pending, setPending] = useState(0);
  const [gpsLabel, setGpsLabel] = useState('GPS · inactif');

  useEffect(() => {
    getUser().then(setUser);
    pendingCount().then(setPending);
    (async () => {
      const bg = await isBackgroundTrackingRunning();
      const fg = isTrackingRunning();
      if (bg) setGpsLabel('GPS · suivi continu (arrière-plan ~60 s / 25 m)');
      else if (fg) setGpsLabel('GPS · suivi actif ~60 s (premier plan)');
      else setGpsLabel('GPS · inactif — autorisez la localisation');
    })().catch(() => undefined);
  }, []);

  return (
    <Screen title="Mon espace" subtitle={user?.companyName || undefined}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <Avatar name={user?.fullName} size={52} />
          <View style={styles.headText}>
            <Text style={styles.name}>{user?.fullName || '—'}</Text>
            <Text style={styles.meta}>{user?.email}</Text>
            <Text style={styles.meta}>Rôle · {user?.role}</Text>
          </View>
        </View>
        <Text style={styles.meta}>File offline · {pending} élément(s)</Text>
        <Text style={styles.meta}>{gpsLabel}</Text>
      </Card>

      <Button onPress={() => nav.navigate('Presence')}>Présence hebdo</Button>
      <Button variant="outline" onPress={() => nav.navigate('VehicleCheck', {})}>
        Checklist véhicule (15 s)
      </Button>
      <Button variant="outline" onPress={() => nav.navigate('Leave')}>
        Congé rapide
      </Button>
      <Button variant="outline" onPress={() => nav.navigate('Expense', {})}>
        Dépense rapide
      </Button>
      <Button variant="outline" onPress={() => nav.navigate('Incident', {})}>
        Incident GPS
      </Button>
      <Button variant="outline" onPress={() => nav.navigate('Settings')}>
        Réglages
      </Button>
      <Button
        variant="danger"
        onPress={async () => {
          await logout();
          onLogout();
        }}
      >
        Déconnexion
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
});
