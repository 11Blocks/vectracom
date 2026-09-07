import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing } from '../../theme/colors';

export function Screen({
  children,
  title,
  subtitle,
  scroll = true,
  right,
  style,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {(title || right) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
});
