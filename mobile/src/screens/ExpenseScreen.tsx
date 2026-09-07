import React, { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Input, Screen } from '../components/ui';
import { spacing } from '../theme/colors';
import { createExpense } from '../services/ops';
import { enqueue, flushQueue } from '../offline/queue';
import { uploadFile } from '../services/api';

export function ExpenseScreen() {
  const route = useRoute<any>();
  const missionId = route.params?.missionId as string | undefined;
  const [category, setCategory] = useState('divers');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) setPhoto(res.assets[0].uri);
  };

  const submit = async () => {
    const n = Number(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Montant invalide');
      return;
    }
    setLoading(true);
    try {
      let receiptPhotoUrl: string | undefined;
      if (photo) {
        try {
          receiptPhotoUrl = await uploadFile(photo, 'receipts');
        } catch {
          receiptPhotoUrl = undefined;
        }
      }
      const payload: Record<string, unknown> = {
        category,
        amount: n,
        description: description || undefined,
        missionId,
        receiptPhotoUrl,
      };
      try {
        if (photo && !receiptPhotoUrl) {
          await enqueue({
            method: 'POST',
            path: '/expenses',
            body: { category, amount: n, description, missionId, receiptPhotoUrl: null },
            localFiles: [{ jsonPath: 'receiptPhotoUrl', uri: photo, category: 'receipts' }],
            missionId,
          });
          flushQueue().catch(() => undefined);
          Alert.alert('Hors-ligne', 'Dépense en file (photo à uploader).');
        } else {
          await createExpense(payload as any);
          Alert.alert('Dépense enregistrée');
        }
      } catch {
        await enqueue({
          method: 'POST',
          path: '/expenses',
          body: payload,
          localFiles: photo && !receiptPhotoUrl ? [{ jsonPath: 'receiptPhotoUrl', uri: photo, category: 'receipts' }] : undefined,
          missionId,
        });
        flushQueue().catch(() => undefined);
        Alert.alert('Hors-ligne', 'Dépense mise en file.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Dépense rapide">
      <Card style={styles.card}>
        <Input label="Catégorie" value={category} onChangeText={setCategory} />
        <Input label="Montant (FCFA) *" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <Input label="Description" value={description} onChangeText={setDescription} />
        {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : null}
        <Button variant="outline" onPress={pick}>{photo ? 'Reprendre reçu' : 'Photo reçu'}</Button>
        <Button loading={loading} onPress={submit}>Enregistrer</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  preview: { width: '100%', height: 140, borderRadius: 10 },
});
