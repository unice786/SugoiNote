import React from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'elevated' | 'surface' | 'inset';
}

export function Card({
  children,
  style,
  onPress,
  variant = 'surface',
}: CardProps) {
  const { tokens } = useTheme();

  const getBg = () => {
    switch (variant) {
      case 'elevated':
        return tokens.bgElevated;
      case 'inset':
        return tokens.bgInset;
      case 'surface':
      default:
        return tokens.bgSurface;
    }
  };

  const cardStyle: ViewStyle = {
    backgroundColor: getBg(),
    borderRadius: tokens.radiusLg,
    borderColor: tokens.borderSubtle,
    borderWidth: 1,
    padding: 16,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          cardStyle,
          {
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.base, cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});
