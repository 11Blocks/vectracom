import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, motion, radius, spacing } from '../../theme/colors';

export function Card({
  children,
  style,
  interactive,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Bordure mint au press — listes / tuiles. */
  interactive?: boolean;
  onPress?: () => void;
}) {
  if (interactive || onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  cardPressed: {
    backgroundColor: colors.accent,
    borderColor: colors.interactiveBorder,
    transform: [{ scale: motion.pressScale }],
  },
});
