import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/colors';

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn, style]}
    >
      <Text style={[styles.text, selected && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value?: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => (
        <Chip key={opt} label={opt} selected={value === opt} onPress={() => onChange(opt)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft15,
  },
  text: { fontSize: 12, color: colors.muted },
  textOn: { color: colors.primary, fontWeight: '600' },
});
