import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radius, spacing } from '../../theme/colors';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = Omit<ToastItem, 'id'>;

const ToastContext = createContext<{ toast: (t: ToastInput) => void }>({
  toast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

const borderByVariant: Record<ToastVariant, string> = {
  success: colors.focusRing,
  error: colors.dangerSoft50,
  warning: colors.warningSoft50,
  info: colors.border,
};

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: motion.toastMs, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: motion.toastMs, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 8, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={dismiss}
        style={[styles.toast, { borderColor: borderByVariant[item.variant] }]}
      >
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const toast = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
        {toasts.map((t) => (
          <ToastBubble
            key={t.id}
            item={t}
            onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    gap: spacing.sm,
  },
  toast: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  desc: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
