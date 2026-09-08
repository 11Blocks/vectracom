import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/colors';

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 40, alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 14, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  desc: { fontSize: 12, color: colors.mutedFaint, textAlign: 'center', maxWidth: 280 },
  action: { marginTop: spacing.sm },
});
