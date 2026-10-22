import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { tokens } = useTheme();

  const getBackgroundColor = (pressed: boolean) => {
    if (disabled) return tokens.bgElevated;
    switch (variant) {
      case 'primary':
        return pressed ? tokens.accentHover : tokens.accent;
      case 'secondary':
        return pressed ? tokens.bgInset2 : tokens.bgElevated;
      case 'danger':
        return pressed ? tokens.dangerSoft : tokens.danger;
      case 'outline':
      case 'ghost':
        return pressed ? tokens.onSurface04 : 'transparent';
    }
  };

  const getTextColor = () => {
    if (disabled) return tokens.textMuted;
    switch (variant) {
      case 'primary':
      case 'danger':
        return tokens.accentContrast;
      case 'secondary':
        return tokens.textPrimary;
      case 'outline':
      case 'ghost':
        return tokens.accent;
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') {
      return disabled ? tokens.borderSubtle : tokens.borderStrong;
    }
    return 'transparent';
  };

  const height = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const paddingHorizontal = size === 'sm' ? 12 : size === 'lg' ? 24 : 16;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal,
          borderRadius: tokens.radiusMd,
          backgroundColor: getBackgroundColor(pressed),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1.5 : 0,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#fff' : tokens.accent}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize,
                marginLeft: icon ? 8 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
  },
});