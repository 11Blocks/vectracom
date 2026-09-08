import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, motion, radius, spacing } from '../../theme/colors';
import { Button } from './Button';

export function Modal({
  open,
  onClose,
  title,
  children,
  style,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (open) {
      opacity.setValue(0);
      scale.setValue(0.96);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: motion.modalMs, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: motion.modalMs, useNativeDriver: true }),
      ]).start();
    }
  }, [open, opacity, scale]);

  return (
    <RNModal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={{ opacity, transform: [{ scale }], width: '100%' }}>
          <Pressable style={[styles.sheet, style]} onPress={(e) => e.stopPropagation()}>
            {title ? (
              <View style={styles.head}>
                <Text style={styles.title}>{title}</Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Text style={styles.close}>Fermer</Text>
                </Pressable>
              </View>
            ) : null}
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </RNModal>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger,
  loading,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      <View style={styles.actions}>
        <Button variant="outline" onPress={onClose} style={{ flex: 1 }}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          loading={loading}
          onPress={onConfirm}
          style={{ flex: 1 }}
        >
          {confirmLabel}
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  close: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  desc: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
