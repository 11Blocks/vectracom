import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radius } from '../../theme/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'ai';
type Size = 'sm' | 'md' | 'lg' | 'icon';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  textStyle,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        pressed && !isDisabled && pressedStyles[variant],
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          color={variant === 'ai' ? colors.bg : colors.white}
          style={{ marginRight: size === 'icon' ? 0 : 8 }}
        />
      )}
      {typeof children === 'string' ? (
        <Text style={[styles.text, textVariants[variant], size === 'sm' && { fontSize: 12 }, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  text: { fontWeight: '600' },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { height: 36, paddingHorizontal: 12 },
  md: { height: 44, paddingHorizontal: 16 },
  lg: { height: 52, paddingHorizontal: 20 },
  icon: { height: 44, width: 44, paddingHorizontal: 0 },
};

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
  outline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ai: { backgroundColor: colors.amber },
};

const pressedStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primaryHover, transform: [{ scale: 0.98 }] },
  secondary: { backgroundColor: colors.accent, transform: [{ scale: 0.98 }] },
  danger: { backgroundColor: colors.dangerHover, transform: [{ scale: 0.98 }] },
  ghost: { backgroundColor: colors.accent, transform: [{ scale: 0.98 }] },
  outline: { backgroundColor: colors.accent, transform: [{ scale: 0.98 }] },
  ai: { backgroundColor: colors.amberHover, transform: [{ scale: 0.98 }] },
};

const textVariants: Record<Variant, TextStyle> = {
  primary: { color: colors.white, fontSize: 14 },
  secondary: { color: colors.text, fontSize: 14 },
  danger: { color: colors.white, fontSize: 14 },
  ghost: { color: colors.muted, fontSize: 14 },
  outline: { color: colors.text, fontSize: 14 },
  ai: { color: colors.bg, fontSize: 14 },
};
