import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Badge, Modal, ListSkeleton, EmptyState, ErrorState } from '../../../components/ui';
import { comunidad, ErrorApi } from '../../../api/client';

const TAMANO_PAGINA = 20;

async function elegirImagen(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert('Permiso necesario', 'Concede acceso a tus fotos para adjuntar una imagen.');
    return null;
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
  });

  if (resultado.canceled || !resultado.assets[0]?.base64) return null;

  const asset = resultado.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
}

function SelectorImagen({
  valor,
  onCambiar,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  const { tokens } = useTheme();
  const [cargando, setCargando] = useState(false);

  const elegir = async () => {
    setCargando(true);
    try {
      const dataUri = await elegirImagen();
      if (dataUri) onCambiar(dataUri);
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.imagenSelector}>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>Imagen de portada (opcional)</Text>
      {valor ? (
        <View style={styles.imagenPreviewWrap}>
          <Image source={{ uri: valor }} style={styles.imagenPreview} resizeMode="cover" />
          <Pressable
            onPress={() => onCambiar('')}
            style={styles.imagenQuitar}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Quitar imagen"
          >
            <Ionicons name="close-circle" size={24} color={tokens.danger} />
          </Pressable>
        </View>
      ) : (
        <Button
          title="Adjuntar imagen"
          size="sm"
          variant="outline"
          loading={cargando}
          onPress={elegir}
          icon={<Ionicons name="image-outline" size={16} color={tokens.accent} />}
        />
      )}
    </View>
  );
}

function formatearFecha(valor?: string | null) {
  if (!valor) return '';
  try {
    return new Date(valor).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ComunidadListScreen() {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState<'post' | 'encuesta' | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['comunidad'],
    queryFn: ({ pageParam }) => comunidad.listar(pageParam),
    initialPageParam: 0,
    getNextPageParam: (ultimaPagina, paginas) =>
      ultimaPagina.length === TAMANO_PAGINA ? paginas.length : undefined,
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    }, [queryClient])
  );

  const lista = useMemo(() => {
    const posts = (data?.pages ?? []).flat();
    if (!busqueda.trim()) return posts;
    const q = busqueda.toLowerCase().trim();
    return posts.filter(
      (p) =>
        p.titulo.toLowerCase().includes(q) ||
        p.detalle.toLowerCase().includes(q) ||
        p.autor.toLowerCase().includes(q)
    );
  }, [data, busqueda]);

  if (isLoading && !data) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <View style={styles.content}>
          <ListSkeleton count={4} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <ErrorState
          title="No se pudo cargar la comunidad"
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
        <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[tokens.accent]} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Comunidad</Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            Pregunta, publica encuestas y ayuda a otros estudiantes
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            title="Post"
            size="sm"
            variant="outline"
            onPress={() => setCreando('post')}
            icon={<Ionicons name="chatbubble-outline" size={16} color={tokens.accent} />}
          />
          <Button
            title="Encuesta"
            size="sm"
            onPress={() => setCreando('encuesta')}
            icon={<Ionicons name="podium-outline" size={16} color={tokens.accentContrast} />}
          />
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }]}>
        <Ionicons name="search" size={18} color={tokens.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: tokens.textPrimary }]}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar post o encuestas..."
          placeholderTextColor={tokens.textMuted}
        />
      </View>

      {lista.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Aún no hay publicaciones"
          message="Sé el primero en publicar en la comunidad."
        >
          <Button title="Publicar un post" onPress={() => setCreando('post')} />
        </EmptyState>
      ) : (
        <View style={styles.list}>
          {lista.map((post) => (
            <Pressable
              key={post.postId}
              onPress={() => router.push(`/(tabs)/comunidad/${post.postId}`)}
              accessibilityRole="button"
              accessibilityLabel={post.titulo}
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
                <Ionicons
                  name={post.esEncuesta ? 'podium' : 'chatbubble-ellipses'}
                  size={20}
                  color={tokens.accent}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: tokens.textPrimary }]} numberOfLines={2}>
                  {post.titulo}
                </Text>
                <Text style={[styles.cardDate, { color: tokens.textMuted }]}>
                  {post.autor} · {formatearFecha(post.fecha)}
                </Text>
                <View style={styles.cardMeta}>
                  {post.esEncuesta ? (
                    <Badge variant="accent" size="sm">
                      Encuesta
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm">
                      Pregunta
                    </Badge>
                  )}
                  <Badge variant="default" size="sm">
                    {post.totalRespuestas} respuestas
                  </Badge>
                  {post.esEncuesta && (
                    <Badge variant="default" size="sm">
                      {post.totalVotos} votos
                    </Badge>
                  )}
                  {post.esMio && (
                    <Badge variant="success" size="sm">
                      Tuya
                    </Badge>
                  )}
                </View>
                {post.imagenUrl ? (
                  <Image source={{ uri: post.imagenUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={tokens.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      {hasNextPage && !busqueda.trim() ? (
        <Button
          title="Cargar más"
          variant="outline"
          fullWidth
          loading={isFetchingNextPage}
          onPress={() => fetchNextPage()}
        />
      ) : null}

      <CrearPostModal visible={creando === 'post'} onClose={() => setCreando(null)} />
      <CrearEncuestaModal visible={creando === 'encuesta'} onClose={() => setCreando(null)} />
    </ScrollView>
  );
}

function CrearPostModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { tokens } = useTheme();
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const crear = useMutation({
    mutationFn: async () => {
      if (!titulo.trim() || !detalle.trim()) {
        throw new Error('Título y detalle son obligatorios.');
      }
      return comunidad.crearPost({ titulo: titulo.trim(), detalle: detalle.trim(), imagenUrl: imagenUrl.trim() || undefined });
    },
    onSuccess: async () => {
      setTitulo('');
      setDetalle('');
      setImagenUrl('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      onClose();
    },
    onError: (err: any) => {
      setError((err as ErrorApi)?.message ?? 'No se pudo crear el post');
    },
  });

  return (
    <Modal visible={visible} title="Crear post" onClose={onClose}>
      <View style={styles.modalContent}>
        <Text style={[styles.label, { color: tokens.textSecondary }]}>Título</Text>
        <TextInput
          style={[styles.textInput, { color: tokens.textPrimary, backgroundColor: tokens.bgInset, borderColor: tokens.borderDefault }]}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="¿Qué quieres preguntar?"
          placeholderTextColor={tokens.textMuted}
        />
        <Text style={[styles.label, { color: tokens.textSecondary }]}>Detalle</Text>
        <TextInput
          multiline
          style={[styles.textArea, { color: tokens.textPrimary, backgroundColor: tokens.bgInset, borderColor: tokens.borderDefault }]}
          value={detalle}
          onChangeText={setDetalle}
          placeholder="Describe tu pregunta con el mayor detalle posible"
          placeholderTextColor={tokens.textMuted}
        />
        <SelectorImagen valor={imagenUrl} onCambiar={setImagenUrl} />
        {error ? (
          <Text style={[styles.errorText, { color: tokens.danger }]}>{error}</Text>
        ) : null}
        <View style={styles.modalActions}>
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
          <Button title="Publicar" loading={crear.isPending} onPress={() => crear.mutate()} />
        </View>
      </View>
    </Modal>
  );
}

function CrearEncuestaModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { tokens } = useTheme();
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [opciones, setOpciones] = useState<string[]>(['', '']);
  const [imagenUrl, setImagenUrl] = useState('');
  const [soloUna, setSoloUna] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const agregarOpcion = () => setOpciones((prev) => [...prev, '']);
  const actualizarOpcion = (index: number, valor: string) => {
    setOpciones((prev) => prev.map((o, i) => (i === index ? valor : o)));
  };
  const eliminarOpcion = (index: number) => {
    setOpciones((prev) => prev.filter((_, i) => i !== index));
  };

  const crear = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error('El título es obligatorio.');
      const ops = opciones.map((o) => o.trim()).filter((o) => o.length > 0);
      if (ops.length < 2) throw new Error('Agrega al menos 2 opciones.');
      return comunidad.crearEncuesta({
        titulo: titulo.trim(),
        detalle: detalle.trim() || undefined,
        opciones: ops,
        imagenUrl: imagenUrl.trim() || undefined,
        soloUnaOpcion: soloUna,
      });
    },
    onSuccess: async () => {
      setTitulo('');
      setDetalle('');
      setOpciones(['', '']);
      setImagenUrl('');
      setSoloUna(true);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      onClose();
    },
    onError: (err: any) => {
      setError((err as ErrorApi)?.message ?? 'No se pudo crear la encuesta');
    },
  });

  return (
    <Modal visible={visible} title="Crear encuesta" onClose={onClose}>
      <ScrollView style={styles.modalContent}>
        <Text style={[styles.label, { color: tokens.textSecondary }]}>Título</Text>
        <TextInput
          style={[styles.textInput, { color: tokens.textPrimary, backgroundColor: tokens.bgInset, borderColor: tokens.borderDefault }]}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Título de la encuesta"
          placeholderTextColor={tokens.textMuted}
        />
        <Text style={[styles.label, { color: tokens.textSecondary }]}>Detalle (opcional)</Text>
        <TextInput
          multiline
          style={[styles.textArea, { color: tokens.textPrimary, backgroundColor: tokens.bgInset, borderColor: tokens.borderDefault }]}
          value={detalle}
          onChangeText={setDetalle}
          placeholder="Explicación opcional"
          placeholderTextColor={tokens.textMuted}
        />
        <Text style={[styles.label, { color: tokens.textSecondary }]}>Opciones</Text>
        {opciones.map((o, idx) => (
          <View key={idx} style={styles.optionRow}>
            <TextInput
              style={[styles.textInput, { flex: 1, color: tokens.textPrimary, backgroundColor: tokens.bgInset, borderColor: tokens.borderDefault }]}
              value={o}
              onChangeText={(v) => actualizarOpcion(idx, v)}
              placeholder={`Opción ${idx + 1}`}
              placeholderTextColor={tokens.textMuted}
            />
            {opciones.length > 2 && (
              <Pressable onPress={() => eliminarOpcion(idx)} style={styles.optionRemove}>
                <Ionicons name="close-circle" size={20} color={tokens.danger} />
              </Pressable>
            )}
          </View>
        ))}
        <Button title="Agregar opción" size="sm" variant="outline" onPress={agregarOpcion} />
        <Pressable
          onPress={() => setSoloUna(!soloUna)}
          style={styles.checkboxRow}
        >
          <Ionicons
            name={soloUna ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={soloUna ? tokens.accent : tokens.textMuted}
          />
          <Text style={[styles.checkboxText, { color: tokens.textPrimary }]}>
            Permitir solo una respuesta por votante
          </Text>
        </Pressable>
        <SelectorImagen valor={imagenUrl} onCambiar={setImagenUrl} />
        {error ? (
          <Text style={[styles.errorText, { color: tokens.danger }]}>{error}</Text>
        ) : null}
        <View style={styles.modalActions}>
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
          <Button title="Publicar" loading={crear.isPending} onPress={() => crear.mutate()} />
        </View>
      </ScrollView>
    </Modal>
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
  headerActions: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
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
  cardImage: { width: '100%', height: 140, borderRadius: 12, marginTop: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  modalContent: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 90 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionRemove: { padding: 4 },
  imagenSelector: { gap: 8, marginTop: 4 },
  imagenPreviewWrap: { position: 'relative' },
  imagenPreview: { width: '100%', height: 160, borderRadius: 12 },
  imagenQuitar: { position: 'absolute', top: 6, right: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  checkboxText: { fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  errorText: { fontSize: 12, fontWeight: '500' },
});
