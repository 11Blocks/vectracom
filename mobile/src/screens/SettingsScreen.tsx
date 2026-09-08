import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, Input, Screen, useToast } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import {
  getApiUrl,
  getDefaultApiUrl,
  loadApiUrlOverride,
  pingHealth,
  setApiUrlOverride,
} from '../services/api';
import { flushQueue, pendingCount } from '../offline/queue';
import { getLastPushToken, getPushCapability, registerPushToken } from '../services/push';
import { isBackgroundTrackingRunning } from '../tracking/background';
import { isTrackingRunning } from '../tracking/foreground';

export function SettingsScreen() {
  const { toast } = useToast();
  const [apiUrl, setApiUrl] = useState(getApiUrl());
  const [health, setHealth] = useState<string>('…');
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [gps, setGps] = useState('…');
  const [pushLabel, setPushLabel] = useState('…');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    await loadApiUrlOverride();
    setApiUrl(getApiUrl());
    setPending(await pendingCount());
    const cap = getPushCapability();
    const token = await getLastPushToken();
    setPushToken(token);
    if (cap === 'expo-go-blocked') {
      setPushLabel('Bloqué (Expo Go Android SDK 53+) — besoin d’un dev build');
    } else if (token) {
      setPushLabel('Token enregistré');
    } else if (cap === 'dev-build') {
      setPushLabel('Dev build — pas encore de token (EAS projectId / permission)');
    } else {
      setPushLabel('Disponible — pas encore enregistré');
    }
    const bg = await isBackgroundTrackingRunning().catch(() => false);
    const fg = isTrackingRunning();
    if (bg) setGps('Arrière-plan actif');
    else if (fg) setGps('Premier plan (~60 s)');
    else setGps('Inactif');
    const h = await pingHealth();
    setHealthOk(h.ok);
    setHealth(h.detail);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const saveApi = async () => {
    setSaving(true);
    try {
      const next = apiUrl.trim();
      if (!/^https?:\/\//i.test(next)) {
        toast({ title: 'URL invalide', description: 'Doit commencer par http:// ou https://', variant: 'warning' });
        return;
      }
      await setApiUrlOverride(next);
      toast({ title: 'API enregistrée', description: getApiUrl(), variant: 'success' });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const resetApi = async () => {
    await setApiUrlOverride(null);
    setApiUrl(getDefaultApiUrl());
    toast({ title: 'URL remise à app.json', variant: 'info' });
    await refresh();
  };

  const testApi = async () => {
    setTesting(true);
    try {
      await setApiUrlOverride(apiUrl.trim() || null);
      const h = await pingHealth();
      setHealthOk(h.ok);
      setHealth(h.detail);
      toast({
        title: h.ok ? 'API joignable' : 'API injoignable',
        description: h.detail,
        variant: h.ok ? 'success' : 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  const retryPush = async () => {
    const token = await registerPushToken();
    if (token) {
      toast({ title: 'Push OK', description: token.slice(0, 28) + '…', variant: 'success' });
    } else {
      toast({
        title: 'Push non disponible',
        description: getPushCapability() === 'expo-go-blocked'
          ? 'Utilisez un development build'
          : 'Permission, projectId EAS ou Expo Go',
        variant: 'warning',
      });
    }
    await refresh();
  };

  const runtime = isRunningInExpoGo() ? 'Expo Go' : 'Dev / standalone build';
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    '—';

  return (
    <Screen title="Réglages" subtitle={runtime} refreshing={false} onRefresh={refresh}>
      <Card style={styles.card}>
        <Text style={styles.section}>API</Text>
        <Input
          label="URL de base (/api/v1)"
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.row}>
          <Badge tone={healthOk ? 'success' : healthOk === false ? 'danger' : 'neutral'}>
            {health}
          </Badge>
        </View>
        <Button loading={testing} onPress={testApi}>
          Tester la connexion
        </Button>
        <Button variant="outline" loading={saving} onPress={saveApi}>
          Enregistrer l’URL
        </Button>
        <Button variant="ghost" onPress={resetApi}>
          Remettre l’URL app.json
        </Button>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Statuts</Text>
        <Row label="Runtime" value={runtime} />
        <Row label="GPS" value={gps} />
        <Row label="File offline" value={`${pending} élément(s)`} />
        <Row label="Push" value={pushLabel} />
        <Row label="EAS projectId" value={String(projectId)} mono />
        {pushToken ? <Row label="Token" value={`${pushToken.slice(0, 36)}…`} mono /> : null}
        <Button variant="outline" onPress={() => flushQueue().then(refresh)}>
          Forcer sync offline
        </Button>
        <Button variant="outline" onPress={retryPush}>
          Réessayer push
        </Button>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Development build (P2)</Text>
        <Text style={styles.hint}>
          Push Android + GPS Always nécessitent un build natif, pas Expo Go.
        </Text>
        <Text style={styles.mono}>npx expo start --dev-client</Text>
        <Text style={styles.mono}>npx expo run:android</Text>
        <Text style={styles.hint}>
          Ou : eas build --profile development --platform android
        </Text>
      </Card>
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  section: { fontSize: 13, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaRow: { gap: 2 },
  label: { fontSize: 11, color: colors.muted },
  value: { fontSize: 13, color: colors.text },
  mono: { fontFamily: 'monospace', fontSize: 11, color: colors.primary },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});
