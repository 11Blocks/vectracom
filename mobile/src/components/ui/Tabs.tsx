import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/colors';

export function Tabs({
  items,
  value,
  onChange,
  style,
}: {
  items: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, style]}>
      {items.map((item) => {
        const on = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[styles.tab, on && styles.tabOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tabOn: {
    backgroundColor: colors.primary,
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted },
  labelOn: { color: colors.white },
});
