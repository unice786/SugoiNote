import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ApunteDto, ErrorApi, apuntes } from '../api/client';
import { useTema } from '../context/TemaContext';
import { useSesion } from '../context/AuthContext';
import { Aviso, Boton, Campo, Cargando, Encabezado, Insignia, Pantalla, Tarjeta, Vacio } from '../components/ui';
import { espaciado, radius } from '../theme/tokens';

export default function ApuntesScreen() {
  const { colores } = useTema();
  const { estudiante } = useSesion();
  const router = useRouter();

  const [lista, setLista] = useState<ApunteDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState('');

  const cargar = useCallback(async () => {
    try {
      setLista(await apuntes.listar());
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus apuntes.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // useFocusEffect (y no useEffect) recarga los datos cada vez que se vuelve a esta
  // pantalla, que es justo lo que se busca al regresar desde otra.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function crear() {
    const t = tituloNuevo.trim();
    if (t.length === 0) {
      setError('Escribe un título para el apunte.');
      return;
    }
    setCreando(true);
    try {
      setError(null);
      const r = await apuntes.crear(t);
      setTituloNuevo('');
      await cargar();
      router.push({ pathname: '/editor', params: { apunteId: r.apunteId, titulo: t } });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo crear el apunte.');
    } finally {
      setCreando(false);
    }
  }

  function confirmarBorrar(item: ApunteDto) {
    Alert.alert('Eliminar apunte', `¿Seguro que quieres eliminar "${item.tituloNota}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apuntes.eliminar(item.apunteId);
            await cargar();
          } catch (e) {
            setError(e instanceof ErrorApi ? e.message : 'No se pudo eliminar.');
          }
        },
      },
    ]);
  }

  if (cargando) return <Pantalla><Cargando texto="Cargando tus apuntes…" /></Pantalla>;

  return (
    <Pantalla scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: espaciado.lg, paddingTop: espaciado.sm }}>
        <Encabezado
          titulo="Mis apuntes"
          subtitulo={estudiante ? `Hola, ${estudiante.nombreCompleto.split(' ')[0]}` : undefined}
        />

        <Aviso texto={error} onCerrar={() => setError(null)} />

        <Tarjeta style={{ marginBottom: espaciado.lg }}>
          <Campo
            etiqueta="Nuevo apunte"
            value={tituloNuevo}
            onChangeText={setTituloNuevo}
            placeholder="Ej: Biología - mitosis"
            returnKeyType="go"
            onSubmitEditing={crear}
            style={{ marginBottom: 0 }}
          />
          <View style={{ height: espaciado.md }} />
          <Boton titulo="Crear apunte" onPress={crear} cargando={creando} ancho />
        </Tarjeta>

        <FlatList
          data={lista}
          keyExtractor={(x) => x.apunteId}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar();
              }}
              tintColor={colores.accent}
            />
          }
          ListEmptyComponent={
            <Vacio titulo="Aún no tienes apuntes" mensaje="Crea tu primer apunte arriba para empezar." />
          }
          contentContainerStyle={{ paddingBottom: espaciado.xxl, gap: espaciado.md }}
          renderItem={({ item }) => (
            <Tarjeta
              onPress={() => router.push({ pathname: '/editor', params: { apunteId: item.apunteId, titulo: item.tituloNota } })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaciado.md }}>
                <View
                  style={{
                    width: 40, height: 40, borderRadius: radius.sm,
                    backgroundColor: `${colores.accent}22`,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>📄</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colores.textPrimary, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                    {item.tituloNota}
                  </Text>
                  <Text style={{ color: colores.textMuted, fontSize: 12, marginTop: 2 }}>
                    {item.materiaNombre ?? 'Sin materia'}
                    {item.fechaRegistro ? ` · ${formatearFecha(item.fechaRegistro)}` : ''}
                  </Text>
                </View>

                <Pressable onPress={() => confirmarBorrar(item)} hitSlop={10}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </Pressable>
              </View>

              {(item.tieneResumen || item.totalExamenes > 0) && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: espaciado.md }}>
                  {item.tieneResumen ? <Insignia texto="Con resumen" tono="exito" /> : null}
                  {item.totalExamenes > 0 ? <Insignia texto={`${item.totalExamenes} examen(es)`} /> : null}
                </View>
              )}
            </Tarjeta>
          )}
        />
      </View>
    </Pantalla>
  );
}

export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}