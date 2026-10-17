import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, Spinner, useToast } from '../../../components/ui';
import { resumenes, ErrorApi } from '../../../api/client';

export default function GenerarResumenScreen() {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['apuntesDisponibles'],
    queryFn: resumenes.apuntesDisponibles,
  });

  const lista = useMemo(() => data ?? [], [data]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((a) => a.tituloNota.toLowerCase().includes(q));
  }, [lista, busqueda]);

  const generar = useMutation({
    mutationFn: (apunteId: string) => resumenes.generar(apunteId),
    onSuccess: (_data, apunteId) => {
      queryClient.invalidateQueries({ queryKey: ['resumenes'] });
      queryClient.invalidateQueries({ queryKey: ['resumen', apunteId] });
      queryClient.invalidateQueries({ queryKey: ['apuntes'] });
      toast.success('Resumen generado');
      router.replace(`/(tabs)/resumenes/${apunteId}`);
    },
    onError: (err) => toast.error((err as ErrorApi).message),
  });

  const confirmar = (apunteId: string, titulo: string) => {
    Alert.alert(
      'Generar resumen',
      `¿Resumir «${titulo}» con IA? El apunte debe tener contenido de texto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Generar', onPress: () => generar.mutate(apunteId) },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
      <View style={[styles.header, { borderBottomColor: tokens.borderSubtle }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={tokens.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>Generar resumen</Text>
        <View style={styles.iconBtn} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Spinner size="lg" label="Cargando apuntes..." />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            No se pudieron cargar los apuntes
          </Text>
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            {(error as ErrorApi).message}
          </Text>
          <Button title="Reintentar" onPress={() => refetch()} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.help, { color: tokens.textMuted }]}>
            Elige un apunte. La IA leerá su contenido y generará un resumen.
          </Text>

          <Input
            placeholder="Buscar apunte por título..."
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

          {lista.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
                No tienes apuntes
              </Text>
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                Crea un apunte primero para poder resumirlo.
              </Text>
              <Button
                title="Ir a Apuntes"
                onPress={() => router.replace('/(tabs)/apuntes')}
              />
            </View>
          ) : filtrados.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>Sin resultados</Text>
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                Ningún apunte coincide con tu búsqueda.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtrados.map((apunte) => (
                <Pressable
                  key={apunte.apunteId}
                  onPress={() => confirmar(apunte.apunteId, apunte.tituloNota)}
                  disabled={generar.isPending}
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
                  <Text
                    style={[styles.cardTitle, { color: tokens.textPrimary }]}
                    numberOfLines={2}
                  >
                    {apunte.tituloNota}
                  </Text>
                  <Ionicons name="sparkles" size={18} color={tokens.accent} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {generar.isPending && (
        <View style={styles.overlay}>
          <View style={[styles.overlayBox, { backgroundColor: tokens.bgSurface }]}>
            <ActivityIndicator size="large" color={tokens.accent} />
            <Text style={[styles.overlayTitle, { color: tokens.textPrimary }]}>
              La IA está generando tu resumen…
            </Text>
            <Text style={[styles.overlayText, { color: tokens.textMuted }]}>
              Esto puede tardar unos segundos.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  content: { padding: 18, paddingBottom: 60, gap: 12 },
  help: { fontSize: 13, lineHeight: 19 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  list: { gap: 10, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 24, 40, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  overlayBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
    gap: 14,
  },
  overlayTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  overlayText: { fontSize: 13, textAlign: 'center' },
});
