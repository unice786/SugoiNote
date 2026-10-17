import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Skeleton, EmptyState, ErrorState } from '../../components/ui';
import { apuntes, ErrorApi } from '../../api/client';
import { useQuery } from '@tanstack/react-query';

export default function InicioScreen() {
  const { tokens } = useTheme();

  const { data: misApuntes, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['apuntes'],
    queryFn: apuntes.listar,
  });

  const handleCrearApunte = () => {
    router.push('/(tabs)/apuntes/nuevo');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <View style={styles.content}>
          <Skeleton width="55%" height={24} />
          <View style={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width="48%" height={150} radius={16} />
            ))}
          </View>
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

  const recientes = (misApuntes || []).slice(0, 8);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tokens.bgApp }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[tokens.accent]} />
      }
    >
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text style={[styles.greetingTitle, { color: tokens.textPrimary }]}>
            ¡Bienvenido!
          </Text>
          <Text style={[styles.greetingSub, { color: tokens.textMuted }]}>
            Gestiona tus notas con elegancia e inteligencia
          </Text>
        </View>
        <Button title="Nueva nota" onPress={handleCrearApunte} icon={<IconPlus />} size="sm" />
      </View>

      <View style={styles.sectionHeader}>
        <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
          Apuntes recientes
        </Text>
      </View>

      {recientes.length > 0 ? (
        <View style={styles.grid}>
          {recientes.map((apunte) => (
            <Pressable
              key={apunte.apunteId}
              onPress={() => router.push(`/(tabs)/apuntes/${apunte.apunteId}`)}
              accessibilityRole="button"
              accessibilityLabel={apunte.tituloNota}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: tokens.bgSurface, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: tokens.accentTint }]}>
                <Text style={{ fontSize: 20 }}>▤</Text>
              </View>
              <Text style={[styles.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                {apunte.tituloNota}
              </Text>
              <Text style={[styles.cardDate, { color: tokens.textMuted }]}>
                {apunte.fechaRegistro ? new Date(apunte.fechaRegistro).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
              </Text>
              <Text style={[styles.cardLink, { color: tokens.accent }]}>Abrir →</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="document-text-outline"
          title="Aún no tienes apuntes"
          message="¡Crea tu primera nota para empezar!"
        >
          <Button title="Crear mi primer apunte" onPress={handleCrearApunte} variant="primary" />
        </EmptyState>
      )}

      {(misApuntes || []).length > 8 && (
        <View style={styles.verTodos}>
          <Button
            title="Ver todos mis apuntes →"
            onPress={() => router.push('/(tabs)/apuntes')}
            variant="ghost"
            size="sm"
          />
        </View>
      )}
    </ScrollView>
  );
}

function IconPlus({ color }: { color?: string }) {
  return <Text style={{ fontSize: 18, fontWeight: '800', color: color || 'currentColor' }}>+</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 100,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  greeting: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 24, 40, 0.07)',
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  cardDate: {
    fontSize: 12,
    marginTop: 4,
  },
  cardLink: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  verTodos: {
    paddingTop: 8,
  },
});