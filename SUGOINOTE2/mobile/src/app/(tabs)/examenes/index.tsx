import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Badge, ListSkeleton, EmptyState, ErrorState } from '../../../components/ui';
import { examenes, ErrorApi } from '../../../api/client';

type Estado = 'aprobado' | 'regular' | 'reprobado' | 'pendiente';

function estadoDe(nota?: number | null): Estado {
  if (nota == null) return 'pendiente';
  if (nota >= 70) return 'aprobado';
  if (nota >= 50) return 'regular';
  return 'reprobado';
}

const ETIQUETA: Record<Estado, string> = {
  aprobado: 'Aprobado',
  regular: 'Regular',
  reprobado: 'Reprobado',
  pendiente: 'Pendiente',
};

export default function ExamenesListScreen() {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['examenes'],
    queryFn: examenes.listar,
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['examenes'] });
    }, [queryClient])
  );

  const lista = useMemo(() => data ?? [], [data]);

  const fecha = (valor?: string | null) =>
    valor
      ? new Date(valor).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';

  const colorEstado = (estado: Estado) => {
    switch (estado) {
      case 'aprobado':
        return tokens.success;
      case 'regular':
        return tokens.warning;
      case 'reprobado':
        return tokens.danger;
      default:
        return tokens.accent;
    }
  };

  const varianteEstado = (estado: Estado) => {
    switch (estado) {
      case 'aprobado':
        return 'success' as const;
      case 'regular':
        return 'warning' as const;
      case 'reprobado':
        return 'danger' as const;
      default:
        return 'accent' as const;
    }
  };

  if (isLoading && !data) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <View style={styles.content}>
          <ListSkeleton count={5} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <ErrorState
          title="No se pudieron cargar los exámenes"
          message={(error as ErrorApi).message}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tokens.bgApp }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[tokens.success]} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Mis exámenes</Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            Genera exámenes con IA y pon a prueba tus conocimientos
          </Text>
        </View>
        <Button
          title="Generar"
          size="sm"
          onPress={() => router.push('/(tabs)/examenes/generar')}
          style={{ backgroundColor: tokens.success }}
          icon={<Ionicons name="clipboard" size={16} color={tokens.accentContrast} />}
        />
      </View>

      {lista.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="Aún no tienes exámenes"
          message="Genera un examen desde cualquiera de tus apuntes."
        >
          <Button
            title="Generar mi primer examen"
            onPress={() => router.push('/(tabs)/examenes/generar')}
            style={{ backgroundColor: tokens.success }}
            icon={<Ionicons name="clipboard" size={16} color={tokens.accentContrast} />}
          />
        </EmptyState>
      ) : (
        <View style={styles.list}>
          {lista.map((examen) => {
            const estado = estadoDe(examen.nota);
            return (
              <Pressable
                key={examen.examenId}
                onPress={() => router.push(`/(tabs)/examenes/${examen.examenId}`)}
                accessibilityRole="button"
                accessibilityLabel={examen.tituloApunte}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: tokens.bgSurface,
                    borderColor: tokens.borderSubtle,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: tokens.onSurface05 }]}>
                  <Ionicons name="clipboard" size={20} color={tokens.success} />
                </View>

                <View style={styles.cardBody}>
                  <Text
                    style={[styles.cardTitle, { color: tokens.textPrimary }]}
                    numberOfLines={2}
                  >
                    {examen.tituloApunte}
                  </Text>
                  <Text style={[styles.cardDate, { color: tokens.textMuted }]}>
                    {fecha(examen.fecha)}
                    {examen.total ? ` · ${examen.total} preguntas` : ''}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Badge variant={varianteEstado(estado)} size="sm">
                      {estado === 'pendiente'
                        ? 'Pendiente'
                        : `${examen.nota}% — ${ETIQUETA[estado]}`}
                    </Badge>
                  </View>
                </View>

                <Ionicons
                  name={estado === 'pendiente' ? 'play-circle-outline' : 'stats-chart-outline'}
                  size={20}
                  color={colorEstado(estado)}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 100, gap: 12 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  list: { gap: 10, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDate: { fontSize: 12, marginTop: 2 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
});
