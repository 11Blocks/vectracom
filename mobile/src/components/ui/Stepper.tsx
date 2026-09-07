import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/colors';

export function Stepper({
  steps,
  current,
}: {
  steps: Array<{ id: string; label: string }>;
  current: number;
}) {
  return (
    <View style={styles.row}>
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <View key={s.id} style={styles.item}>
            <View style={[styles.dot, (active || done) && styles.dotOn]}>
              <Text style={[styles.num, (active || done) && styles.numOn]}>{i + 1}</Text>
            </View>
            <Text style={[styles.label, active && styles.labelOn]} numberOfLines={1}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  num: { fontSize: 11, fontWeight: '700', color: colors.muted },
  numOn: { color: colors.white },
  label: { fontSize: 9, color: colors.muted, textAlign: 'center' },
  labelOn: { color: colors.primary, fontWeight: '600' },
});
