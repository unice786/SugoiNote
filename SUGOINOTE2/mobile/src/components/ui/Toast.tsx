import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Easing,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ToastContextType {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

type Tokens = ReturnType<typeof useTheme>['tokens'];

function toastColors(tokens: Tokens, type: ToastType) {
  switch (type) {
    case 'success':
      return { bg: tokens.success + '20', text: tokens.success, icon: '✓' };
    case 'error':
      return { bg: tokens.dangerSoft + '20', text: tokens.danger, icon: '✕' };
    case 'warning':
      return { bg: tokens.warning + '20', text: tokens.warning, icon: '⚠' };
    case 'info':
    default:
      return { bg: tokens.accentTint, text: tokens.accent, icon: 'ℹ' };
  }
}

function ToastCard({ item }: { item: ToastItem }) {
  const { tokens } = useTheme();
  const { bg, text, icon } = toastColors(tokens, item.type);

  const fadeAnim = React.useMemo(() => new Animated.Value(0), []);
  const translateAnim = React.useMemo(() => new Animated.Value(20), []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    return () => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateAnim, { toValue: -20, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start();
    };
  }, [item.id, fadeAnim, translateAnim]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: bg },
        { opacity: fadeAnim, transform: [{ translateY: translateAnim }] },
      ]}
    >
      <View style={styles.toastContent}>
        <Text style={[styles.icon, { color: text }]}>{icon}</Text>
        <Text style={[styles.message, { color: text }]}>{item.message}</Text>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [idCounter, setIdCounter] = useState(0);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = idCounter + 1;
    setIdCounter(id);
    const newToast: ToastItem = { id, message, type, duration };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, [idCounter]);

  const success = useCallback((message: string, duration?: number) => show(message, 'success', duration), [show]);
  const error = useCallback((message: string, duration?: number) => show(message, 'error', duration), [show]);
  const info = useCallback((message: string, duration?: number) => show(message, 'info', duration), [show]);
  const warning = useCallback((message: string, duration?: number) => show(message, 'warning', duration), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="none">
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Componente individual para uso directo sin provider
export interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  visible: boolean;
}

export function Toast({ message, type = 'info', onClose, visible }: ToastProps) {
  const { tokens } = useTheme();

  if (!visible) return null;

  const { bg, text, icon } = toastColors(tokens, type);

  return (
    <View style={styles.standaloneToast}>
      <View style={[styles.toast, { backgroundColor: bg }]}>
        <View style={styles.toastContent}>
          <Text style={[styles.icon, { color: text }]}>{icon}</Text>
          <Text style={[styles.message, { color: text }]}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  standaloneToast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});