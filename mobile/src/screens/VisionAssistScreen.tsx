import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AiBlock, Badge, Button, Card, ChipGroup, Input, Screen, useToast } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { uploadFile, api } from '../services/api';
import { analyzeVision, photoAudit, PhotoAuditResult } from '../services/ai';

const RUBRIQUES = ['PBO', 'PIO', 'CHAMBRE'] as const;

function guessRubrique(text: string): (typeof RUBRIQUES)[number] {
  const t = text.toLowerCase();
  if (t.includes('pio') || t.includes('poteau')) return 'PIO';
  if (t.includes('chambre') || t.includes('regard')) return 'CHAMBRE';
  return 'PBO';
}

export function VisionAssistScreen() {
  const { toast } = useToast();
  const [photo, setPhoto] = useState<string | null>(null);
  const [zone, setZone] = useState('');
  const [note, setNote] = useState('');
  const [rubrique, setRubrique] = useState<(typeof RUBRIQUES)[number]>('PBO');
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [audit, setAudit] = useState<PhotoAuditResult | null>(null);
  const [visionSummary, setVisionSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const capture = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) {
      setPhoto(res.assets[0].uri);
      setAudit(null);
      setVisionSummary(null);
    }
  };

  const captureGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      toast({ title: 'GPS', description: 'Permission refusée', variant: 'warning' });
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  };

  const ensureUrl = async () => {
    if (!photo) throw new Error('Photo requise');
    if (audit?.photoUrl) return audit.photoUrl;
    return uploadFile(photo, 'ia-vision');
  };

  const runAudit = async () => {
    if (!photo) {
      toast({ title: 'Photo requise', variant: 'warning' });
      return;
    }
    setLoading('audit');
    try {
      const url = await uploadFile(photo, 'ia-vision');
      const result = await photoAudit(url);
      setAudit(result);
      setRubrique(guessRubrique(`${note} ${zone}`));
    } catch (e: any) {
      toast({ title: 'Pré-audit', description: e?.message || 'Échec', variant: 'error' });
    } finally {
      setLoading(null);
    }
  };

  const createSignalement = async () => {
    if (!photo || !zone.trim()) {
      toast({ title: 'Photo et zone requises', variant: 'warning' });
      return;
    }
    setLoading('create');
    try {
      const url = await ensureUrl();
      await api.post('/incidents', {
        rubrique,
        zone: zone.trim(),
        source: 'MOBILE',
        annotationOriginale: note.trim() || undefined,
        photos: [{ type: 'signalement', url }],
        ...(gps ? { gpsLatitude: gps.lat, gpsLongitude: gps.lon } : {}),
      });
      toast({ title: 'Signalement créé', description: 'Validation humaine côté web', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Incident', description: e?.message || 'Échec', variant: 'error' });
    } finally {
      setLoading(null);
    }
  };

  const runFullVision = async () => {
    if (!photo) {
      toast({ title: 'Photo requise', variant: 'warning' });
      return;
    }
    setLoading('vision');
    try {
      const url = await ensureUrl();
      const result = await analyzeVision({
        imageUrl: url,
        annotation: [zone, note].filter(Boolean).join(' — ') || undefined,
        gpsLatitude: gps?.lat,
        gpsLongitude: gps?.lon,
      });
      const summary = `${result.incident?.incidentNumber || 'OK'} · ${
        result.analysis?.rubriqueDetected || result.incident?.rubrique || '—'
      } (conf. ${result.analysis?.confidenceRubrique || '?'} %)`;
      setVisionSummary(summary);
      toast({
        title: 'Proposition IA Vision',
        description: 'Validation humaine requise côté web',
        variant: 'success',
      });
    } catch (e: any) {
      toast({ title: 'IA Vision', description: e?.message || 'Échec analyse', variant: 'error' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Screen title="Vision" subtitle="Photo · pré-audit · signalement">
      <Card style={styles.card}>
        {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : null}
        <Button variant="outline" onPress={capture}>
          {photo ? 'Reprendre photo' : 'Prendre photo'}
        </Button>
        <Button variant="outline" onPress={captureGps}>
          {gps ? `GPS ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'Capturer GPS'}
        </Button>
        <Input label="Zone *" value={zone} onChangeText={setZone} placeholder="Ex. Mbour / Popenguine" />
        <Input
          label="Annotation"
          value={note}
          onChangeText={(t) => {
            setNote(t);
            setRubrique(guessRubrique(`${t} ${zone}`));
          }}
          multiline
          placeholder="PBO désorganisé, plaque…"
        />
        <Text style={styles.label}>Rubrique</Text>
        <ChipGroup
          options={[...RUBRIQUES]}
          value={rubrique}
          onChange={(v) => setRubrique(v as (typeof RUBRIQUES)[number])}
        />
      </Card>

      {audit ? (
        <AiBlock title="Pré-audit photo">
          <View style={styles.row}>
            <Text style={styles.section}>Verdict</Text>
            <Badge tone={audit.verdict === 'accepte' ? 'success' : 'warning'}>
              {audit.verdict} · {audit.score}
            </Badge>
          </View>
          <Text style={styles.flags}>
            {audit.flags?.length ? audit.flags.join(' · ') : 'Aucun flag — proposition à valider'}
          </Text>
        </AiBlock>
      ) : null}

      {visionSummary ? (
        <AiBlock title="Analyse IA Vision">
          <Text style={styles.flags}>{visionSummary}</Text>
          <Text style={styles.note}>L’IA propose — validation humaine obligatoire.</Text>
        </AiBlock>
      ) : null}

      <Button loading={loading === 'audit'} onPress={runAudit} variant="secondary">
        Lancer pré-audit
      </Button>
      <Button loading={loading === 'create'} onPress={createSignalement}>
        Créer signalement
      </Button>
      <Button loading={loading === 'vision'} variant="ai" onPress={runFullVision}>
        Analyse IA Vision (proposition)
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  preview: { width: '100%', height: 180, borderRadius: 10 },
  label: { fontSize: 12, fontWeight: '500', color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 13, fontWeight: '600', color: colors.text },
  flags: { fontSize: 12, color: colors.muted },
  note: { fontSize: 11, color: colors.muted, fontStyle: 'italic' },
});
