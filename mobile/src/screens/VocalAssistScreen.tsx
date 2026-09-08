import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as IntentLauncher from 'expo-intent-launcher';
import { AiBlock, Badge, Button, Chip, Input, Screen, useToast } from '../components/ui';
import { colors, radius, spacing } from '../theme/colors';
import { voiceCommand, VoiceCommandResult } from '../services/ai';
import { listMissions, updateMissionStatus } from '../services/missions';

const SUGGESTIONS = [
  'Signaler un incident PBO à Mbour',
  'Enregistrer une dépense carburant 15000 FCFA',
  'Clôturer la mission',
  'Ouvrir le stock',
  'Prendre une photo',
  'Demander un congé',
];

/** Android Expo Go : micro système (RecognizerIntent). iOS → saisie. */
async function listenAndroidSpeech(): Promise<string | null> {
  const result = await IntentLauncher.startActivityAsync('android.speech.action.RECOGNIZE_SPEECH', {
    extra: {
      'android.speech.extra.LANGUAGE_MODEL': 'free_form',
      'android.speech.extra.LANGUAGE': 'fr-FR',
      'android.speech.extra.PROMPT': 'Dites votre commande VECTRACOM…',
      'android.speech.extra.MAX_RESULTS': 3,
    },
  });
  if (result.resultCode !== IntentLauncher.ResultCode.Success) return null;
  const extra = (result.extra || {}) as Record<string, unknown>;
  const results =
    (extra['android.speech.extra.RESULTS'] as string[] | undefined) ||
    (extra.androidSpeechExtraResults as string[] | undefined) ||
    (extra.results as string[] | undefined);
  if (Array.isArray(results) && results[0]) return String(results[0]).trim();
  const single = extra['android.speech.extra.RESULTS'] ?? extra.query;
  if (typeof single === 'string' && single.trim()) return single.trim();
  return null;
}

export function VocalAssistScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { toast } = useToast();
  const missionId = route.params?.missionId as string | undefined;
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<VoiceCommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [executing, setExecuting] = useState(false);

  const analyze = async (text?: string) => {
    const cmd = (text ?? command).trim();
    if (cmd.length < 3) {
      toast({ title: 'Commande trop courte', variant: 'warning' });
      return;
    }
    setCommand(cmd);
    setLoading(true);
    try {
      const r = await voiceCommand(cmd, missionId);
      setResult(r);
    } catch (e: any) {
      toast({ title: 'Vocal', description: e?.message || 'Échec', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const startMic = async () => {
    if (Platform.OS !== 'android') {
      toast({
        title: 'Micro',
        description: 'Sur iOS Expo Go, utilisez la saisie ou le micro du clavier.',
        variant: 'info',
      });
      return;
    }
    setListening(true);
    try {
      const heard = await listenAndroidSpeech();
      if (!heard) {
        toast({ title: 'Rien entendu', description: 'Réessayez ou saisissez la commande.', variant: 'warning' });
        return;
      }
      setCommand(heard);
      await analyze(heard);
    } catch (e: any) {
      toast({
        title: 'Micro indisponible',
        description: e?.message || 'Activez Google Speech / micro système.',
        variant: 'error',
      });
    } finally {
      setListening(false);
    }
  };

  const confirm = async () => {
    if (!result) return;
    setExecuting(true);
    try {
      const { intent, entities } = result;
      switch (intent) {
        case 'signaler_incident':
          nav.navigate('Incident', { zone: entities.zone || '', missionId });
          break;
        case 'enregistrer_depense':
          nav.navigate('Expense', {
            missionId,
            amount: entities.montant,
            category: /carburant|essence|gasoil/.test(result.command.toLowerCase())
              ? 'transport'
              : 'divers',
          });
          break;
        case 'consulter_stock':
          nav.navigate('StockScan', { missionId });
          break;
        case 'prendre_photo':
          nav.navigate('VisionAssist');
          break;
        case 'cloturer_mission': {
          let id = missionId;
          let status: string | undefined;
          if (id) {
            const { getMission } = await import('../services/missions');
            const m = await getMission(id);
            status = m.status;
          } else {
            const list = await listMissions({ status: 'en_cours' });
            id = list[0]?.id;
            status = list[0]?.status;
          }
          if (!id) {
            toast({ title: 'Aucune mission en cours', variant: 'warning' });
            break;
          }
          if (status === 'planifiee' || status === 'a_completer') {
            await updateMissionStatus(id, 'en_cours');
          }
          await updateMissionStatus(id, 'terminee');
          toast({ title: 'Mission clôturée', description: 'Statut → terminee', variant: 'success' });
          nav.navigate('MissionDetail', { id });
          break;
        }
        case 'creer_mission':
          toast({
            title: 'Création mission',
            description: `Disponible sur le web-admin. Type : ${entities.missionType || '—'}`,
            variant: 'info',
          });
          break;
        case 'demander_conge':
          nav.navigate('Leave');
          break;
        default:
          toast({
            title: 'Intent inconnu',
            description: 'Reformulez (ex. « signaler incident PBO »).',
            variant: 'warning',
          });
      }
    } catch (e: any) {
      toast({ title: 'Exécution', description: e?.message || 'Échec', variant: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Screen title="Vocal" subtitle="Parlez ou saisissez — vous confirmez l’intention">
      <Pressable
        onPress={startMic}
        disabled={listening || loading}
        style={({ pressed }) => [
          styles.micBtn,
          (pressed || listening) && styles.micBtnActive,
          (listening || loading) && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.micTitle}>{listening ? 'Écoute…' : 'Appuyer pour parler'}</Text>
        <Text style={styles.micSub}>
          {Platform.OS === 'android'
            ? 'Micro système Android (français)'
            : 'Saisie / micro clavier sur cette plateforme'}
        </Text>
      </Pressable>

      <AiBlock title="Commande">
        <Input
          label="Texte (modifiable)"
          value={command}
          onChangeText={setCommand}
          placeholder="Ex. signaler un incident PBO…"
          multiline
        />
        <Button loading={loading} variant="ai" onPress={() => analyze()}>
          Analyser
        </Button>
      </AiBlock>

      <Text style={styles.hint}>Suggestions</Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} onPress={() => analyze(s)} style={styles.chipAi} />
        ))}
      </View>

      {result ? (
        <AiBlock title="Intention détectée">
          <View style={styles.row}>
            <Text style={styles.section}>Intent</Text>
            <Badge tone="ai">{result.intent}</Badge>
          </View>
          {Object.keys(result.entities || {}).length > 0 ? (
            <Text style={styles.meta}>
              {Object.entries(result.entities)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </Text>
          ) : (
            <Text style={styles.meta}>Aucune entité extraite</Text>
          )}
          <Text style={styles.meta}>Actions : {(result.proposedActions || []).join(', ')}</Text>
          <Text style={styles.note}>{result.note}</Text>
          <Button loading={executing} onPress={confirm}>
            Confirmer et ouvrir
          </Button>
        </AiBlock>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    backgroundColor: colors.aiSurface,
    borderWidth: 1,
    borderColor: colors.aiBorder,
    borderRadius: radius.lg,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  micBtnActive: {
    backgroundColor: colors.amber,
    borderColor: colors.amberHover,
  },
  micTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  micSub: { fontSize: 12, color: colors.muted, marginTop: 4, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 4, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chipAi: {
    borderColor: colors.aiBorder,
    backgroundColor: colors.aiSurface,
    maxWidth: '100%',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 13, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  note: { fontSize: 11, color: colors.muted, fontStyle: 'italic' },
});
