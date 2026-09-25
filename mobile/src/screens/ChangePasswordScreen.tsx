import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input, Screen, useToast } from '../components/ui';
import { colors, radius, spacing } from '../theme/colors';
import { changePassword, logout } from '../services/api';

/**
 * forced = mot de passe temporaire défini par un admin : écran bloquant après login.
 * Sinon accessible depuis « Mon espace ».
 */
export function ChangePasswordScreen({
  forced = false,
  onDone,
  onLogout,
}: {
  forced?: boolean;
  onDone?: () => void;
  onLogout?: () => void;
}) {
  const nav = useNavigation<any>();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (next !== confirm) return setError('Les deux mots de passe ne correspondent pas');
    if (next.length < 8) return setError('Minimum 8 caractères');
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return setError('Au moins une lettre et un chiffre');
    setLoading(true);
    try {
      await changePassword(current, next);
      toast({ title: 'Mot de passe modifié', variant: 'success' });
      if (onDone) onDone();
      else if (nav.canGoBack()) nav.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'Modification impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title={forced ? 'Nouveau mot de passe' : undefined}>
      {forced ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Changement obligatoire</Text>
          <Text style={styles.bannerText}>
            Votre mot de passe a été défini par un administrateur. Choisissez-en un nouveau pour continuer.
          </Text>
        </View>
      ) : null}
      <Card style={styles.card}>
        <Input
          label={forced ? 'Mot de passe temporaire' : 'Mot de passe actuel'}
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
        />
        <Input label="Nouveau mot de passe" secureTextEntry value={next} onChangeText={setNext} />
        <Input label="Confirmer" secureTextEntry value={confirm} onChangeText={setConfirm} />
        <Text style={styles.hint}>8 caractères minimum, avec au moins une lettre et un chiffre.</Text>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
        <Button loading={loading} onPress={submit}>
          Enregistrer
        </Button>
        {forced && onLogout ? (
          <Button
            variant="outline"
            onPress={async () => {
              await logout();
              onLogout();
            }}
          >
            Se déconnecter
          </Button>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  hint: { fontSize: 12, color: colors.muted },
  banner: {
    borderWidth: 1,
    borderColor: colors.warningSoft50,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  bannerText: { fontSize: 12, color: colors.muted },
  errorBox: {
    backgroundColor: colors.dangerSoft12,
    borderWidth: 1,
    borderColor: colors.dangerSoft35,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  error: { color: colors.danger, fontSize: 13 },
});
