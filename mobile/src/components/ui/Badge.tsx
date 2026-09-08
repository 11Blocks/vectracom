import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { StatusTone, statusColors, radius } from '../../theme/colors';

export function Badge({
  children,
  tone = 'neutral',
  /** Alias web API. */
  variant,
  style,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  variant?: StatusTone;
  style?: ViewStyle;
}) {
  const c = statusColors[variant || tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      <Text style={[styles.text, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '600' },
});
