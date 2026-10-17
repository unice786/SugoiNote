import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  title = 'Algo salió mal',
  message,
  onRetry,
  retryLabel = 'Reintentar',
  style,
}: ErrorStateProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconBox, { backgroundColor: tokens.onSurface05 }]}>
        <Ionicons name="alert-circle-outline" size={34} color={tokens.danger} />
      </View>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: tokens.textMuted }]}>{message}</Text> : null}
      {onRetry ? <Button title={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 12,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
