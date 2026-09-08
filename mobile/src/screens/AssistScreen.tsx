import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AiBlock, Badge, Card, Screen } from '../components/ui';
import { colors, spacing } from '../theme/colors';

const TILES = [
  {
    key: 'Vision',
    title: 'Vision',
    subtitle: 'Photo → pré-audit IA → signalement',
    tone: 'primary' as const,
  },
  {
    key: 'Vocal',
    title: 'Vocal',
    subtitle: 'Commande → intention → confirmation',
    tone: 'amber' as const,
  },
  {
    key: 'Messages',
    title: 'Messages',
    subtitle: 'Remontée · équipes (chat terrain)',
    tone: 'primary' as const,
  },
];

export function AssistScreen() {
  const nav = useNavigation<any>();

  return (
    <Screen title="Assist" subtitle="Vision · Vocal · Messages">
      <AiBlock title="Hub Assist terrain">
        <Text style={styles.aiHint}>
          L’IA propose — vous validez. Vision, vocal et messages partagent le design system VECTRACOM.
        </Text>
      </AiBlock>

      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              if (t.key === 'Vision') nav.navigate('VisionAssist');
              if (t.key === 'Vocal') nav.navigate('VocalAssist', {});
              if (t.key === 'Messages') nav.navigate('Messages');
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <Card style={[styles.tile, t.tone === 'amber' && styles.tileAmber]}>
              <View style={styles.tileHead}>
                <Text style={[styles.title, t.tone === 'amber' && styles.titleAmber]}>{t.title}</Text>
                {t.tone === 'amber' ? <Badge tone="ai">IA</Badge> : null}
              </View>
              <Text style={styles.sub}>{t.subtitle}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  aiHint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  grid: { gap: spacing.md },
  tile: { gap: 6, paddingVertical: 18 },
  tileAmber: { borderColor: colors.aiBorder, borderWidth: 1 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.primary },
  titleAmber: { color: colors.amber },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
});
