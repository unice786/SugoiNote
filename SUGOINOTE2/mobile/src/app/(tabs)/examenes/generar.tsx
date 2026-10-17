import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, Spinner, useToast } from '../../../components/ui';
import { apuntes, examenes, ErrorApi } from '../../../api/client';

type Tipo = 'opcion_multiple' | 'verdadero_falso';

const TIPOS: { valor: Tipo; etiqueta: string; icono: 'list' | 'swap-horizontal' }[] = [
  { valor: 'opcion_multiple', etiqueta: 'Opción múltiple', icono: 'list' },
  { valor: 'verdadero_falso', etiqueta: 'Verdadero o Falso', icono: 'swap-horizontal' },
];

const CANTIDADES = [5, 8, 10, 15, 20];

export default function GenerarExamenScreen() {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<Tipo>('opcion_multiple');
  const [cantidad, setCantidad] = useState(10);
  const [apunteId, setApunteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['apuntes'],
    queryFn: apuntes.listar,
  });

  const lista = useMemo(() => data ?? [], [data]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((a) => a.tituloNota.toLowerCase().includes(q));
  }, [lista, busqueda]);

  const seleccionado = useMemo(
    () => lista.find((a) => a.apunteId === apunteId) ?? null,
    [lista, apunteId]
  );

  const generar = useMutation({
    mutationFn: () =>
      examenes.generar({ apunteId: apunteId as string, tipo, cantidadPreguntas: cantidad }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['examenes'] });
      queryClient.invalidateQueries({ queryKey: ['examen', res.examenId] });
      toast.success('Examen generado');
      router.replace(`/(tabs)/examenes/${res.examenId}`);
    },
    onError: (err) => toast.error((err as ErrorApi).message),
  });

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
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>Nuevo examen</Text>
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
      ) : lista.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            Aún no tienes apuntes
          </Text>
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            Crea un apunte para poder generar un examen.
          </Text>
          <Button
            title="Ir a Apuntes"
            onPress={() => router.replace('/(tabs)/apuntes')}
            style={{ backgroundColor: tokens.success }}
          />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>
              Tipo de preguntas
            </Text>
            <View style={styles.rowWrap}>
              {TIPOS.map((t) => {
                const activo = tipo === t.valor;
                return (
                  <Pressable
                    key={t.valor}
                    onPress={() => setTipo(t.valor)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activo ? tokens.success : tokens.bgSurface,
                        borderColor: activo ? tokens.success : tokens.borderDefault,
                      },
                    ]}
                  >
                    <Ionicons
                      name={t.icono}
                      size={15}
                      color={activo ? tokens.accentContrast : tokens.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: activo ? tokens.accentContrast : tokens.textSecondary },
                      ]}
                    >
                      {t.etiqueta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>
              Cantidad de preguntas
            </Text>
            <View style={styles.rowWrap}>
              {CANTIDADES.map((c) => {
                const activo = cantidad === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCantidad(c)}
                    style={[
                      styles.numChip,
                      {
                        backgroundColor: activo ? tokens.success : tokens.bgSurface,
                        borderColor: activo ? tokens.success : tokens.borderDefault,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: activo ? tokens.accentContrast : tokens.textSecondary },
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>
              Selecciona un apunte
            </Text>
            <Input
              placeholder="Buscar apunte por título..."
              value={busqueda}
              onChangeText={setBusqueda}
              leftIcon={<Ionicons name="search" size={18} color={tokens.textMuted} />}
            />

            {filtrados.length === 0 ? (
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                Ningún apunte coincide con tu búsqueda.
              </Text>
            ) : (
              <View style={styles.list}>
                {filtrados.map((apunte) => {
                  const activo = apunte.apunteId === apunteId;
                  return (
                    <Pressable
                      key={apunte.apunteId}
                      onPress={() => setApunteId(apunte.apunteId)}
                      style={({ pressed }) => [
                        styles.card,
                        {
                          backgroundColor: tokens.bgSurface,
                          borderColor: activo ? tokens.success : tokens.borderSubtle,
                          borderWidth: activo ? 1.5 : 1,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.cardIcon, { backgroundColor: tokens.onSurface05 }]}>
                        <Ionicons name="document-text" size={18} color={tokens.success} />
                      </View>
                      <View style={styles.cardBody}>
                        <Text
                          style={[styles.cardTitle, { color: tokens.textPrimary }]}
                          numberOfLines={2}
                        >
                          {apunte.tituloNota}
                        </Text>
                        {apunte.materiaNombre ? (
                          <Text style={[styles.cardMeta, { color: tokens.textMuted }]}>
                            {apunte.materiaNombre}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={activo ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={activo ? tokens.success : tokens.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { backgroundColor: tokens.bgSurface, borderTopColor: tokens.borderSubtle },
            ]}
          >
            <View style={styles.footerInfo}>
              <Text style={[styles.footerTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                {seleccionado ? seleccionado.tituloNota : 'Ningún apunte seleccionado'}
              </Text>
              <Text style={[styles.footerSub, { color: tokens.textMuted }]}>
                {cantidad} preguntas · {tipo === 'opcion_multiple' ? 'Opción múltiple' : 'Verdadero o Falso'}
              </Text>
            </View>
            <Button
              title="Generar con IA"
              onPress={() => generar.mutate()}
              disabled={!apunteId || generar.isPending}
              style={{ backgroundColor: tokens.success }}
              icon={<Ionicons name="sparkles" size={16} color={tokens.accentContrast} />}
            />
          </View>
        </>
      )}

      {generar.isPending && (
        <View style={styles.overlay}>
          <View style={[styles.overlayBox, { backgroundColor: tokens.bgSurface }]}>
            <ActivityIndicator size="large" color={tokens.success} />
            <Text style={[styles.overlayTitle, { color: tokens.textPrimary }]}>
              Generando tu examen…
            </Text>
            <Text style={[styles.overlayText, { color: tokens.textMuted }]}>
              La IA está creando preguntas basadas en tu apunte.
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
  content: { padding: 18, paddingBottom: 24, gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 2 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  numChip: {
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  list: { gap: 10, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardMeta: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
  },
  footerInfo: { flex: 1 },
  footerTitle: { fontSize: 13, fontWeight: '700' },
  footerSub: { fontSize: 11, marginTop: 2 },
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
