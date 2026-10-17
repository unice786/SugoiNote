import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Skeleton } from './Skeleton';

export interface ListSkeletonProps {
  count?: number;
}

export function ListSkeleton({ count = 5 }: ListSkeletonProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.list} accessibilityLabel="Cargando contenido">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.card, { backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }]}
        >
          <Skeleton width={42} height={42} radius={12} />
          <View style={styles.body}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="45%" height={12} />
            <Skeleton width="55%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 8 },
});
