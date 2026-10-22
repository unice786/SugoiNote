import React from 'react';
import { Animated, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const { tokens } = useTheme();
  const [opacity] = React.useState(() => new Animated.Value(0.45));

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? tokens.radiusSm,
          backgroundColor: tokens.onSurface08,
          opacity,
        },
        style,
      ]}
    />
  );
}
