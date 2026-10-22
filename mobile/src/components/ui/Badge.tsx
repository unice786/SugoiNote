import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
}: BadgeProps) {
  const { tokens } = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'accent':
        return { bg: tokens.accentTint, text: tokens.accent, border: 'transparent' };
      case 'success':
        return { bg: tokens.successSoft + '20', text: tokens.success, border: 'transparent' };
      case 'warning':
        return { bg: tokens.warning + '20', text: tokens.warning, border: 'transparent' };
      case 'danger':
        return { bg: tokens.dangerSoft + '20', text: tokens.danger, border: 'transparent' };
      case 'info':
        return { bg: tokens.infoSoft + '20', text: tokens.info, border: 'transparent' };
      case 'outline':
        return { bg: 'transparent', text: tokens.accent, border: tokens.borderStrong };
      default:
        return { bg: tokens.bgElevated, text: tokens.textSecondary, border: tokens.borderSubtle };
    }
  };

  const { bg, text, border } = getColors();

  const paddingH = size === 'sm' ? 8 : size === 'lg' ? 12 : 10;
  const paddingV = size === 'sm' ? 2 : size === 'lg' ? 6 : 4;
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 13 : 12;
  const borderRadius = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderRadius,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: text, fontSize }, textStyle]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    lineHeight: 16,
  },
});