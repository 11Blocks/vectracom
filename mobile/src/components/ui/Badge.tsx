import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { StatusTone, statusColors } from '../../theme/colors';

export function Badge({
  children,
  tone = 'neutral',
  style,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  style?: ViewStyle;
}) {
  const c = statusColors[tone];
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
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 10, fontWeight: '600' },
});
