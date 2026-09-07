import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input } from '../components/ui';
import { colors, spacing } from '../theme/colors';
import { login } from '../services/api';

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('admin@onecomit.sn');
  const [password, setPassword] = useState('ChangeMe!2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (e: any) {
      setError(e?.message ?? 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Text style={styles.logoMark}>V</Text>
        </View>
        <Text style={styles.title}>
          VEC<Text style={{ color: colors.primary }}>TRA</Text>COM
        </Text>
        <Text style={styles.sub}>Terrain — offline-first</Text>
      </View>

      <Card style={styles.card}>
        <Input
          label="Adresse e-mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="nom@entreprise.sn"
        />
        <Input
          label="Mot de passe"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button loading={loading} onPress={submit}>
          Se connecter
        </Button>
        <Text
          style={styles.forgot}
          onPress={() => Alert.alert('Mot de passe oublié', 'Utilisez le portail web /forgot-password.')}
        >
          Mot de passe oublié ?
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(15,157,112,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoMark: { color: colors.primary, fontWeight: '800', fontSize: 22 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: 'rgba(232,237,233,0.5)' },
  card: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
  forgot: { textAlign: 'center', color: colors.primary, fontSize: 12, marginTop: 4 },
});
