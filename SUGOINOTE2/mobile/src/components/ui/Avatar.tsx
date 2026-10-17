import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ImageSourcePropType,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  source?: ImageSourcePropType;
  name?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#8b5cf6',
    '#15803d', '#16a34a', '#b45309', '#dc2626', '#1d4ed8',
    '#0f172a', '#4338ca', '#0e7490', '#9f1239', '#7c2d12',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ source, name, size = 'md', style }: AvatarProps) {
  const { tokens } = useTheme();

  const sizeMap: Record<AvatarSize, { width: number; fontSize: number }> = {
    xs: { width: 24, fontSize: 10 },
    sm: { width: 32, fontSize: 12 },
    md: { width: 40, fontSize: 14 },
    lg: { width: 48, fontSize: 16 },
    xl: { width: 64, fontSize: 22 },
  };

  const { width, fontSize } = sizeMap[size];
  const bgColor = name ? getColorFromName(name) : tokens.accent;
  const initials = name ? getInitials(name) : '?';

  if (source) {
    return (
      <View style={[styles.container, { width, height: width }, style]}>
        <Image
          source={source}
          style={[styles.image, { width, height: width, borderRadius: width / 2 }]}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width, height: width, borderRadius: width / 2, backgroundColor: bgColor },
        style,
      ]}
    >
      <Text style={[styles.initials, { color: '#fff', fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    borderRadius: 999,
  },
  initials: {
    fontWeight: '800',
    lineHeight: 20,
  },
});