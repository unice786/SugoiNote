import React, { useCallback, useMemo, useState } from 'react';
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
import { Button, Badge, Input, ListSkeleton, EmptyState, ErrorState } from '../../../components/ui';
import { apuntes, ErrorApi } from '../../../api/client';

export default function ApuntesListScreen() {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [materia, setMateria] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['apuntes'],
    queryFn: apuntes.listar,
  });

  // Al volver del editor o de crear, refresca la lista.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['apuntes'] });
    }, [queryClient])
  );

  const lista = useMemo(() => data ?? [], [data]);

  const materias = useMemo(() => {
    const set = new Set<string>();
    lista.forEach((a) => {
      if (a.materiaNombre) set.add(a.materiaNombre);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [lista]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista.filter((a) => {
      const coincideTexto = !q || a.tituloNota.toLowerCase().includes(q);
      const coincideMateria = !materia || a.materiaNombre === materia;
      return coincideTexto && coincideMateria;
    });
  }, [lista, busqueda, materia]);

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
          title="No se pudieron cargar los apuntes"
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
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[tokens.accent]} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Mis apuntes</Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            Organiza y gestiona todos tus apuntes
          </Text>
        </View>
        <Button
          title="Nuevo"
          size="sm"
          onPress={() => router.push('/(tabs)/apuntes/nuevo')}
          icon={<Ionicons name="add" size={18} color={tokens.accentContrast} />}
        />
      </View>

      <Input
        placeholder="Buscar por título..."
        value={busqueda}
        onChangeText={setBusqueda}
        autoCorrect={false}
        leftIcon={<Ionicons name="search" size={18} color={tokens.textMuted} />}
        rightIcon={
          busqueda ? (
            <Pressable
              onPress={() => setBusqueda('')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
            >
              <Ionicons name="close-circle" size={18} color={tokens.textMuted} />
            </Pressable>
          ) : undefined
        }
      />

      {materias.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          <Chip label="Todas" activo={materia === null} onPress={() => setMateria(null)} />
          {materias.map((m) => (
            <Chip
              key={m}
              label={m}
              activo={materia === m}
              onPress={() => setMateria(materia === m ? null : m)}
            />
          ))}
        </ScrollView>
      )}

      {lista.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="Aún no tienes apuntes"
          message="¡Crea tu primera nota para empezar!"
        >
          <Button
            title="Crear mi primer apunte"
            onPress={() => router.push('/(tabs)/apuntes/nuevo')}
          />
        </EmptyState>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Sin resultados"
          message="Ningún apunte coincide con tu búsqueda."
        />
      ) : (
        <View style={styles.list}>
          {filtrados.map((apunte) => (
            <Pressable
              key={apunte.apunteId}
              onPress={() => router.push(`/(tabs)/apuntes/${apunte.apunteId}`)}
              accessibilityRole="button"
              accessibilityLabel={apunte.tituloNota}
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
                <Ionicons name="document-text" size={20} color={tokens.accent} />
              </View>

              <View style={styles.cardBody}>
                <Text
                  style={[styles.cardTitle, { color: tokens.textPrimary }]}
                  numberOfLines={1}
                >
                  {apunte.tituloNota}
                </Text>
                <Text style={[styles.cardDate, { color: tokens.textMuted }]}>
                  {fecha(apunte.fechaRegistro)}
                </Text>
                <View style={styles.cardMeta}>
                  {apunte.materiaNombre ? (
                    <Badge variant="accent" size="sm">
                      {apunte.materiaNombre}
                    </Badge>
                  ) : null}
                  {apunte.tieneResumen ? (
                    <Badge variant="success" size="sm">
                      Resumen
                    </Badge>
                  ) : null}
                  {apunte.totalExamenes > 0 ? (
                    <Badge variant="info" size="sm">
                      {apunte.totalExamenes} examen{apunte.totalExamenes === 1 ? '' : 'es'}
                    </Badge>
                  ) : null}
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

function Chip({
  label,
  activo,
  onPress,
}: {
  label: string;
  activo: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: activo ? tokens.accent : tokens.bgSurface,
          borderColor: activo ? tokens.accent : tokens.borderDefault,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: activo ? tokens.accentContrast : tokens.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
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
