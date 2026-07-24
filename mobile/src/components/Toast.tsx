import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function dismissToast(id: string) {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function showToast(message: string, type: ToastType = 'info') {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current[id] = setTimeout(() => dismissToast(id), 3500);
  }

  const contextValue = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: 'checkmark-circle', color: '#22C55E' },
  error:   { icon: 'close-circle',    color: '#EF4444' },
  info:    { icon: 'information-circle', color: '#0D9488' },
  warning: { icon: 'warning',         color: '#F59E0B' },
};

// ─── Single Toast ────────────────────────────────────────────────────────────

function ToastItem({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[item.type];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  function handleDismiss() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 80,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(item.id));
  }

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: c.surface,
          borderLeftColor: config.color,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Ionicons
        name={config.icon as any}
        size={22}
        color={config.color}
        style={styles.toastIcon}
      />
      <Text
        style={[styles.toastMessage, { color: c.text }]}
        numberOfLines={3}
      >
        {item.message}
      </Text>
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.toastClose}
      >
        <Ionicons name="close" size={16} color={c.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Container ───────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    width: SCREEN_WIDTH - tokens.spacing6 * 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radiusMd,
    borderLeftWidth: 4,
    paddingVertical: tokens.spacing3 + 2,
    paddingHorizontal: tokens.spacing4,
    marginBottom: tokens.spacing2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  toastIcon: {
    marginRight: tokens.spacing3,
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  toastClose: {
    marginLeft: tokens.spacing3,
    padding: 2,
  },
});