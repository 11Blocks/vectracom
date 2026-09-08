import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing } from '../../theme/colors';
import { Badge } from './Badge';

function SparklesIcon({ size = 14, color = colors.amber }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
        fill={color}
      />
      <Path
        d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"
        fill={color}
        opacity={0.85}
      />
    </Svg>
  );
}

/** Panneau IA — miroir web AiBlock (amber border / fill + Sparkles). */
export function AiBlock({
  children,
  title = 'Recommandations IA',
  style,
}: {
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.block, style]}>
      <View style={styles.head}>
        <SparklesIcon />
        <Text style={styles.title}>{title}</Text>
        <Badge tone="ai">IA</Badge>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.aiSurface,
    borderWidth: 1,
    borderColor: colors.aiBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.amber,
  },
});
