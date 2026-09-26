import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Badge, Button, Card, ChipGroup, Input, Screen, Stepper } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import {
  getMission,
  getTemplateForMission,
  MissionTemplate,
  saveFieldReportData,
  TemplateStep,
  TemplateStepField,
} from '../services/missions';
import { NetworkError, uploadFile } from '../services/api';
import { enqueue, flushQueue } from '../offline/queue';

type Answers = Record<string, any>;

function isLocalUri(uri: string) {
  return !!uri && /^(file|content|ph|assets-library):/i.test(uri);
}

async function uploadLocalFiles(data: Answers): Promise<Answers> {
  const out: Answers = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' && isLocalUri(val)) out[key] = await uploadFile(val);
    else if (Array.isArray(val)) {
      out[key] = await Promise.all(val.map((v) => (typeof v === 'string' && isLocalUri(v) ? uploadFile(v) : v)));
    } else out[key] = val;
  }
  return out;
}

function validateStep(step: TemplateStep, answers: Answers): string | null {
  for (const f of step.fields || []) {
    if (!f.required) continue;
    const v = answers[f.id];
    if (f.type === 'boolean') {
      if (v !== true) return `Champ requis : ${f.label}`;
      continue;
    }
    if (f.type === 'checklist') {
      if (f.id === 'materialsConsumed') {
        const lines = Array.isArray(v) ? v : [];
        if (lines.length === 0 || !lines.some((l: any) => l.designation && Number(l.quantity) > 0)) {
          return `Conso matériel requise : ${f.label}`;
        }
        continue;
      }
      const opts = f.options || [];
      const checked = (v as Record<string, boolean>) || {};
      if (opts.some((o) => !checked[o])) return `Checklist incomplète : ${f.label}`;
      continue;
    }
    if (f.type === 'photos') {
      if (!v || (Array.isArray(v) && v.length === 0)) return `Photo requise : ${f.label}`;
      continue;
    }
    if (v == null || String(v).trim() === '') return `Champ requis : ${f.label}`;
  }
  return null;
}

export function DynamicMissionFormScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const missionId = route.params?.id as string;

  const [template, setTemplate] = useState<MissionTemplate | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingLocal, setPendingLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const mission = await getMission(missionId);
        const tpl = await getTemplateForMission(mission);
        setTemplate(tpl);
      } catch (e: any) {
        setError(e?.message ?? 'Template introuvable');
      } finally {
        setLoading(false);
      }
    })();
  }, [missionId]);

  const steps = template?.steps ?? [];
  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const setField = (id: string, value: any) => setAnswers((a) => ({ ...a, [id]: value }));

  const collectLocalFiles = (data: Answers) => {
    const files: Array<{ jsonPath: string; uri: string }> = [];
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'string' && isLocalUri(val)) {
        files.push({ jsonPath: `data.data.${key}`, uri: val });
      }
      if (Array.isArray(val)) {
        val.forEach((uri, i) => {
          if (typeof uri === 'string' && isLocalUri(uri)) {
            files.push({ jsonPath: `data.data.${key}.${i}`, uri });
          }
        });
      }
    }
    return files;
  };

  /** Upload des photos/signatures locales puis envoi ; file hors-ligne uniquement si le réseau manque. */
  const persist = async (nextAnswers: Answers, markDone?: boolean): Promise<boolean> => {
    setSaving(true);
    let wentOffline = false;
    try {
      try {
        const uploaded = await uploadLocalFiles(nextAnswers);
        setAnswers(uploaded);
        await saveFieldReportData(missionId, uploaded);
        setPendingLocal(false);
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e;
        await enqueue({
          method: 'POST',
          path: `/missions/${missionId}/field-report/step/data`,
          body: { data: { data: nextAnswers } },
          localFiles: collectLocalFiles(nextAnswers),
          missionId,
        });
        wentOffline = true;
        setPendingLocal(true);
        flushQueue().catch(() => undefined);
      }
      if (markDone) {
        Alert.alert(
          'Enregistré',
          wentOffline ? 'Sauvegardé hors-ligne — sync automatique.' : 'Formulaire synchronisé.',
        );
        nav.goBack();
      }
      return true;
    } catch (e: any) {
      Alert.alert('Enregistrement refusé', e?.message ?? 'Sauvegarde impossible');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onNext = async () => {
    if (!step) return;
    const err = validateStep(step, answers);
    if (err) {
      Alert.alert(step.blocking ? 'Étape bloquante' : 'Champs requis', err);
      return;
    }
    if (isLast) {
      await persist(answers, true);
      return;
    }
    if (await persist(answers, false)) setStepIndex((i) => i + 1);
  };

  if (loading) {
    return (
      <Screen title="Formulaire">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!template || !step) {
    return (
      <Screen title="Formulaire">
        <Text style={{ color: colors.danger }}>{error || 'Aucune étape'}</Text>
      </Screen>
    );
  }

  return (
    <Screen
      title={template.label}
      subtitle={template.typeName}
      right={pendingLocal ? <Badge tone="warning">Offline</Badge> : null}
    >
      <Stepper steps={steps.map((s) => ({ id: s.id, label: s.label }))} current={stepIndex} />

      <Card style={styles.card}>
        <View style={styles.stepHead}>
          <Text style={styles.stepTitle}>{step.label}</Text>
          {step.blocking ? <Badge tone="danger">Bloquante</Badge> : null}
        </View>

        {(step.fields || []).map((field) => (
          <FieldEditor key={field.id} field={field} value={answers[field.id]} onChange={(v) => setField(field.id, v)} />
        ))}
      </Card>

      <View style={styles.actions}>
        <Button
          variant="secondary"
          disabled={stepIndex === 0 || saving}
          onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
          style={{ flex: 1 }}
        >
          Précédent
        </Button>
        <Button loading={saving} onPress={onNext} style={{ flex: 1 }}>
          {isLast ? 'Clôturer' : 'Suivant'}
        </Button>
      </View>
    </Screen>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: TemplateStepField;
  value: any;
  onChange: (v: any) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
        <Switch
          value={!!value}
          onValueChange={onChange}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
    );
  }

  if (field.type === 'select') {
    return (
      <View style={styles.fieldGap}>
        <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
        <ChipGroup
          options={field.options || []}
          value={value}
          onChange={onChange}
        />
      </View>
    );
  }

  if (field.type === 'checklist') {
    // Bordereau conso : checklist générique → lignes qté (M5)
    if (field.id === 'materialsConsumed') {
      const lines: Array<{ designation: string; quantity: string }> = Array.isArray(value)
        ? value.map((l: any) => ({
            designation: String(l.designation ?? l.label ?? ''),
            quantity: String(l.quantity ?? 1),
          }))
        : [{ designation: '', quantity: '1' }];
      return (
        <View style={styles.fieldGap}>
          <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
          {lines.map((l, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Input
                label={`Désignation ${i + 1}`}
                value={l.designation}
                onChangeText={(t) => {
                  const next = [...lines];
                  next[i] = { ...next[i], designation: t };
                  onChange(
                    next.map((x, idx) => ({
                      itemNumber: idx + 1,
                      designation: x.designation,
                      quantity: Number(x.quantity) || 1,
                    })),
                  );
                }}
              />
              <Input
                label="Qté"
                keyboardType="decimal-pad"
                value={l.quantity}
                onChangeText={(t) => {
                  const next = [...lines];
                  next[i] = { ...next[i], quantity: t };
                  onChange(
                    next.map((x, idx) => ({
                      itemNumber: idx + 1,
                      designation: x.designation,
                      quantity: Number(x.quantity) || 1,
                    })),
                  );
                }}
              />
            </View>
          ))}
          <Pressable
            onPress={() =>
              onChange([
                ...lines.map((x, idx) => ({
                  itemNumber: idx + 1,
                  designation: x.designation,
                  quantity: Number(x.quantity) || 1,
                })),
                { itemNumber: lines.length + 1, designation: '', quantity: 1 },
              ])
            }
          >
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>+ Ligne</Text>
          </Pressable>
        </View>
      );
    }
    const checked: Record<string, boolean> = value || {};
    return (
      <View style={styles.fieldGap}>
        <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
        {(field.options || []).map((opt) => (
          <Pressable
            key={opt}
            style={styles.checkRow}
            onPress={() => onChange({ ...checked, [opt]: !checked[opt] })}
          >
            <View style={[styles.box, checked[opt] && styles.boxOn]} />
            <Text style={styles.checkLabel}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  if (field.type === 'photos' || field.type === 'signature') {
    const uri = Array.isArray(value) ? value[0] : value;
    const pick = async () => {
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!res.canceled && res.assets[0]?.uri) {
        onChange(field.type === 'photos' ? [res.assets[0].uri] : res.assets[0].uri);
      }
    };
    return (
      <View style={styles.fieldGap}>
        <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
        {uri ? <Image source={{ uri }} style={styles.preview} /> : null}
        <Button variant="outline" size="sm" onPress={pick}>
          {uri ? 'Reprendre' : field.type === 'signature' ? 'Capturer signature' : 'Prendre photo'}
        </Button>
      </View>
    );
  }

  if (field.type === 'number') {
    return (
      <Input
        label={`${field.label}${field.required ? ' *' : ''}`}
        keyboardType="decimal-pad"
        value={value != null ? String(value) : ''}
        onChangeText={(t) => onChange(t === '' ? null : Number(t))}
      />
    );
  }

  return (
    <Input
      label={`${field.label}${field.required ? ' *' : ''}`}
      value={value != null ? String(value) : ''}
      onChangeText={onChange}
    />
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  stepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  fieldGap: { gap: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { color: colors.text, fontSize: 13 },
  preview: { width: '100%', height: 160, borderRadius: 10, backgroundColor: colors.cardAlt },
});
