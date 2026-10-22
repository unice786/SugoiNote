import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Badge, Spinner } from '../../../components/ui';
import { comunidad, ErrorApi } from '../../../api/client';

function formatearFecha(valor?: string | null) {
  if (!valor) return '';
  try {
    return new Date(valor).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ComunidadDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const [respuesta, setRespuesta] = useState('');
  const [votando, setVotando] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['comunidad', id],
    queryFn: () => comunidad.obtener(id!),
    enabled: !!id,
  });

  useFocusEffect(
    React.useCallback(() => {
      if (id) queryClient.invalidateQueries({ queryKey: ['comunidad', id] });
      queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    }, [id, queryClient])
  );

  const responder = useMutation({
    mutationFn: async () => {
      if (!respuesta.trim()) throw new Error('Escribe una respuesta.');
      return comunidad.responder(id!, respuesta.trim());
    },
    onSuccess: async () => {
      setRespuesta('');
      await queryClient.invalidateQueries({ queryKey: ['comunidad', id] });
      await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    },
  });

  const votar = useMutation({
    mutationFn: async (opcionId: string) => {
      return comunidad.votar(id!, [opcionId]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comunidad', id] });
      await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      setVotando(null);
    },
    onError: (err: any) => {
      setVotando(null);
      Alert.alert('Error', (err as ErrorApi)?.message ?? 'No se pudo votar');
    },
  });

  const totalVotos = useMemo(() => data?.totalVotos ?? 0, [data]);

  const eliminar = useMutation({
    mutationFn: async () => comunidad.eliminar(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', (err as ErrorApi)?.message ?? 'No se pudo eliminar la publicación');
    },
  });

  const confirmarEliminar = () => {
    Alert.alert('Eliminar publicación', '¿Seguro que quieres eliminarla? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminar.mutate() },
    ]);
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>No se pudo cargar la publicación</Text>
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>{(error as ErrorApi).message}</Text>
          <Button title="Volver" variant="outline" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (isLoading || !data) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <Spinner size="lg" label="Cargando publicación..." />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: tokens.bgApp }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={tokens.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]} numberOfLines={2}>
            {data.titulo}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            {data.autor} · {formatearFecha(data.fecha)}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }]}>
        {data.imagenUrl ? (
          <Image source={{ uri: data.imagenUrl }} style={styles.coverImage} resizeMode="cover" />
        ) : null}
        <Text style={[styles.detail, { color: tokens.textPrimary }]}>{data.detalle}</Text>
        <View style={styles.metaRow}>
          <Badge variant={data.esEncuesta ? 'accent' : 'outline'} size="sm">
            {data.esEncuesta ? 'Encuesta' : 'Pregunta'}
          </Badge>
          <Badge variant="default" size="sm">
            {data.respuestas.length} respuestas
          </Badge>
          {data.esEncuesta && (
            <Badge variant="default" size="sm">
              {totalVotos} votos
            </Badge>
          )}
          {data.esMio && (
            <Badge variant="success" size="sm">
              Tuya
            </Badge>
          )}
        </View>
      </View>

      {data.esEncuesta && data.opciones.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Opciones de la encuesta</Text>
          {data.opciones.map((opcion) => {
            const porcentaje = totalVotos > 0 ? Math.round((opcion.totalVotos / totalVotos) * 100) : 0;
            const seleccionado = opcion.seleccionada;
            return (
              <Pressable
                key={opcion.opcionId}
                onPress={() => {
                  if (votar.isPending) return;
                  setVotando(opcion.opcionId);
                  votar.mutate(opcion.opcionId);
                }}
                disabled={votar.isPending}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor: tokens.bgSurface,
                    borderColor: seleccionado ? tokens.accent : tokens.borderSubtle,
                    opacity: pressed || votar.isPending ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionText, { color: tokens.textPrimary }]} numberOfLines={2}>
                    {opcion.texto}
                  </Text>
                  <Text style={[styles.optionVotes, { color: tokens.textMuted }]}>
                    {opcion.totalVotos} · {porcentaje}%
                  </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: tokens.bgInset }]}>
                  <View
                    style={[
                      styles.progressBar,
                      { backgroundColor: seleccionado ? tokens.accent : tokens.accentSoft, width: `${porcentaje}%` },
                    ]}
                  />
                </View>
                {seleccionado && (
                  <View style={styles.selectedRow}>
                    <Ionicons name="checkmark-circle" size={16} color={tokens.accent} />
                    <Text style={[styles.selectedText, { color: tokens.accent }]}>Tu voto</Text>
                  </View>
                )}
                {votar.isPending && votando === opcion.opcionId && (
                  <Spinner size="sm" label="Registrando voto..." />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Respuestas</Text>
        <View style={[styles.replyCard, { backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }]}>
          <TextInput
            multiline
            style={[styles.replyInput, { color: tokens.textPrimary, backgroundColor: tokens.bgInset, borderColor: tokens.borderDefault }]}
            value={respuesta}
            onChangeText={setRespuesta}
            placeholder="Escribe tu respuesta..."
            placeholderTextColor={tokens.textMuted}
          />
          <View style={styles.replyActions}>
            <Button
              title="Enviar respuesta"
              size="sm"
              onPress={() => responder.mutate()}
              loading={responder.isPending}
              disabled={!respuesta.trim() || responder.isPending}
            />
          </View>
        </View>

        {data.respuestas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>Aún no hay respuestas. Sé el primero en responder.</Text>
          </View>
        ) : (
          <View style={styles.responsesList}>
            {data.respuestas.map((r) => (
              <View key={r.respuestaId} style={[styles.responseCard, { backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }]}>
                <Text style={[styles.responseText, { color: tokens.textPrimary }]}>{r.texto}</Text>
                <Text style={[styles.responseMeta, { color: tokens.textMuted }]}>
                  {r.autor} · {formatearFecha(r.fecha)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {data.esMio && (
        <Button
          title="Eliminar publicación"
          variant="danger"
          fullWidth
          loading={eliminar.isPending}
          onPress={confirmarEliminar}
          icon={<Ionicons name="trash-outline" size={16} color={tokens.accentContrast} />}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 100, gap: 16 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 6 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  coverImage: { width: '100%', height: 200, borderRadius: 12 },
  detail: { fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  optionCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  optionVotes: { fontSize: 12 },
  progressBarBg: { height: 8, borderRadius: 8, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 8 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedText: { fontSize: 12, fontWeight: '600' },
  replyCard: { padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  replyInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 80 },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  emptyState: { paddingVertical: 12 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  responsesList: { gap: 10 },
  responseCard: { padding: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  responseText: { fontSize: 14, lineHeight: 20 },
  responseMeta: { fontSize: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
});
