import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { Card } from './Card';

type Props = {
  title: string;
  mono?: string;
  subtitle?: string;
  meta?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Ligne liste premium — card + titre + mono mint. */
export function ListRow({ title, mono, subtitle, meta, trailing, onPress, style }: Props) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Card interactive={!!onPress} onPress={onPress} style={style}>
        <View style={styles.row}>
          <View style={styles.main}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {mono || subtitle ? (
              <Text style={styles.sub} numberOfLines={1}>
                {mono ? <Text style={styles.mono}>{mono}</Text> : null}
                {mono && subtitle ? ' · ' : null}
                {subtitle ? <Text style={styles.subPlain}>{subtitle}</Text> : null}
              </Text>
            ) : null}
            {meta ? (
              <Text style={styles.meta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  main: { flex: 1, gap: 2, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  sub: { fontSize: 11, color: colors.muted },
  subPlain: { color: colors.muted },
  mono: {
    color: colors.primary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  meta: { fontSize: 11, color: colors.muted },
  trailing: { flexDirection: 'row', gap: 4, flexShrink: 0, alignItems: 'center' },
});
