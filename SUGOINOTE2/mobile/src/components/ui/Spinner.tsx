import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
}

export function Spinner({ size = 'md', color, style, label }: SpinnerProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator
        size={size === 'sm' ? 'small' : size === 'lg' ? 'large' : undefined}
        color={color || tokens.accent}
        style={styles.spinner}
      />
      {label && (
        <View style={styles.labelWrapper}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginBottom: 8,
  },
  labelWrapper: {
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});