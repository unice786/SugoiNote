import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

export interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  children,
  style,
}: EmptyStateProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconBox, { backgroundColor: tokens.onSurface05 }]}>
        <Ionicons name={icon} size={34} color={tokens.accent} />
      </View>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: tokens.textMuted }]}>{message}</Text> : null}
      {children ? <View style={styles.action}>{children}</View> : null}
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
  action: { marginTop: 4 },
});
