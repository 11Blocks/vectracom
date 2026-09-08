import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/colors';

export function StatCard({
  label,
  value,
  hint,
  style,
}: {
  label: string;
  value: string | number;
  hint?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.bar} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  label: { fontSize: 11, color: colors.muted, fontWeight: '600', marginTop: 4 },
  value: { fontSize: 22, fontWeight: '700', color: colors.text },
  hint: { fontSize: 11, color: colors.muted },
});
