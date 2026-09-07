import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/colors';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 40, alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 14, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  desc: { fontSize: 12, color: 'rgba(122,143,128,0.7)', textAlign: 'center', maxWidth: 280 },
});
