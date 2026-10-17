import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  passwordToggle?: boolean;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  passwordToggle = false,
  secureTextEntry,
  value,
  onChangeText,
  placeholder,
  ...rest
}: InputProps) {
  const { tokens } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = passwordToggle || secureTextEntry;
  const actualSecure = isPassword && !showPassword;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: tokens.textSecondary }]}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: tokens.bgSurface,
            borderColor: error
              ? tokens.danger
              : isFocused
              ? tokens.accent
              : tokens.borderDefault,
            borderRadius: tokens.radiusMd,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            {
              color: tokens.textPrimary,
              paddingLeft: leftIcon ? 8 : 14,
              paddingRight: (rightIcon || isPassword) ? 8 : 14,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.textMuted}
          secureTextEntry={actualSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />

        {passwordToggle && (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Text style={{ fontSize: 13, color: tokens.accent, fontWeight: '600' }}>
              {showPassword ? 'Ocultar' : 'Ver'}
            </Text>
          </Pressable>
        )}

        {rightIcon && !passwordToggle && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: tokens.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  leftIcon: {
    paddingLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIcon: {
    paddingRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});
