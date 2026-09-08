import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, Card, Input } from '../components/ui';
import { colors, radius, spacing } from '../theme/colors';
import { login } from '../services/api';

function ShieldMark() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l7 3v5c0 4.5-2.8 8.4-7 10-4.2-1.6-7-5.5-7-10V6l7-3z"
        stroke={colors.primary}
        strokeWidth={1.8}
        fill={colors.primarySoft15}
      />
      <Path d="M9.5 12.2l1.7 1.7 3.5-3.8" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

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
          <ShieldMark />
        </View>
        <Text style={styles.title}>
          VEC<Text style={{ color: colors.primary }}>TRA</Text>COM
        </Text>
        <Text style={styles.sub}>Gestion des opérations terrain</Text>
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
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
        <Button loading={loading} onPress={submit}>
          Se connecter
        </Button>
        <Text
          style={styles.forgot}
          onPress={() =>
            Alert.alert('Mot de passe oublié', 'Utilisez le portail web /forgot-password.')
          }
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
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.primaryBorder25,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.textFaint },
  card: { gap: spacing.md },
  errorBox: {
    backgroundColor: colors.dangerSoft12,
    borderWidth: 1,
    borderColor: colors.dangerSoft35,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  error: { color: colors.danger, fontSize: 13 },
  forgot: { textAlign: 'center', color: colors.primary, fontSize: 12, marginTop: 4 },
});
