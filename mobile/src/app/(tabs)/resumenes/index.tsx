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
import { resumenes, ErrorApi } from '../../../api/client';

export default function ResumenesListScreen() {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['resumenes'],
    queryFn: resumenes.listar,
  });

  // Al volver de generar/ver un resumen, refresca la lista.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['resumenes'] });
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
    const err = error as ErrorApi;
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <ErrorState
          title="No se pudieron cargar los resúmenes"
          message={err.message}
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
        <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[tokens.accent]} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Mis resúmenes</Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            Resúmenes generados con IA desde tus apuntes
          </Text>
        </View>
        <Button
          title="Generar"
          size="sm"
          onPress={() => router.push('/(tabs)/resumenes/generar')}
          icon={<Ionicons name="sparkles" size={16} color={tokens.accentContrast} />}
        />
      </View>

      {lista.length === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title="Aún no tienes resúmenes"
          message="Elige un apunte y deja que la IA resuma su contenido por ti."
        >
          <Button
            title="Generar mi primer resumen"
            onPress={() => router.push('/(tabs)/resumenes/generar')}
            icon={<Ionicons name="sparkles" size={16} color={tokens.accentContrast} />}
          />
        </EmptyState>
      ) : (
        <View style={styles.list}>
          {lista.map((resumen) => (
            <Pressable
              key={resumen.apunteId}
              onPress={() => router.push(`/(tabs)/resumenes/${resumen.apunteId}`)}
              accessibilityRole="button"
              accessibilityLabel={resumen.tituloNota}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: tokens.bgSurface,
                  borderColor: tokens.borderSubtle,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: tokens.accentTint }]}>
                <Ionicons name="sparkles" size={20} color={tokens.accent} />
              </View>

              <View style={styles.cardBody}>
                <Text
                  style={[styles.cardTitle, { color: tokens.textPrimary }]}
                  numberOfLines={2}
                >
                  {resumen.tituloNota}
                </Text>
                {resumen.fechaRegistro ? (
                  <Text style={[styles.cardDate, { color: tokens.textMuted }]}>
                    {fecha(resumen.fechaRegistro)}
                  </Text>
                ) : null}
                <View style={styles.cardMeta}>
                  <Badge variant="accent" size="sm">
                    Resumen IA
                  </Badge>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color={tokens.textMuted} />
            </Pressable>
          ))}
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
