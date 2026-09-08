import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { searchSerials } from '../services/ops';

export function StockScanScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const missionId = route.params?.missionId as string | undefined;
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const lock = useRef(false);

  const lookup = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length < 3) {
        Alert.alert('Scan', 'Au moins 3 caractères.');
        return;
      }
      setLoading(true);
      try {
        const hits = await searchSerials(q);
        if (!hits?.length) {
          Alert.alert('Introuvable', `Aucune série pour « ${q} »`);
          lock.current = false;
          return;
        }
        nav.navigate('SerialDetail', {
          serial: hits[0],
          alternatives: hits.length > 1 ? hits : undefined,
          missionId,
        });
      } catch (e: any) {
        Alert.alert('Recherche', e?.message || 'Échec');
        lock.current = false;
      } finally {
        setLoading(false);
      }
    },
    [nav, missionId],
  );

  const onBarcode = ({ data }: { data: string }) => {
    if (lock.current || loading) return;
    lock.current = true;
    setCameraOn(false);
    lookup(data).finally(() => {
      setTimeout(() => {
        lock.current = false;
        setCameraOn(true);
      }, 1500);
    });
  };

  return (
    <Screen
      title="Scanner"
      subtitle={missionId ? 'Lié à la mission en cours' : 'QR / code-barres ou saisie'}
    >
      {!permission?.granted ? (
        <Card style={styles.card}>
          <Text style={styles.hint}>Autorisez la caméra pour scanner les séries.</Text>
          <Button onPress={requestPermission}>Autoriser la caméra</Button>
        </Card>
      ) : (
        <View style={styles.camWrap}>
          {cameraOn ? (
            <CameraView
              style={styles.cam}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'],
              }}
              onBarcodeScanned={onBarcode}
            />
          ) : (
            <View style={[styles.cam, styles.camPaused]}>
              <Text style={styles.hint}>Recherche…</Text>
            </View>
          )}
          <Text style={styles.overlay}>Cadrez le code série</Text>
        </View>
      )}

      <Card style={styles.card}>
        <Input
          label="Saisie manuelle"
          value={manual}
          onChangeText={setManual}
          placeholder="N° de série ou ND"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Button loading={loading} onPress={() => lookup(manual)}>
          Rechercher
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camWrap: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
  },
  cam: { flex: 1 },
  camPaused: { alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    color: colors.white,
    fontSize: 12,
    backgroundColor: colors.overlaySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  card: { gap: spacing.sm },
  hint: { color: colors.muted, fontSize: 13 },
});
