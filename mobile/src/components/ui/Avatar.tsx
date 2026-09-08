import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/colors';

/** Avatar initiales — cercle mint. */
export function Avatar({
  name,
  size = 48,
  style,
}: {
  name?: string | null;
  size?: number;
  style?: ViewStyle;
}) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primarySoft18,
    borderWidth: 1,
    borderColor: colors.primarySoft35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontWeight: '700', color: colors.primary },
});
