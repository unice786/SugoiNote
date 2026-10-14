import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { ErrorApi, ResumenDto, resumenes } from '../api/client';
import { useTema } from '../context/TemaContext';
import { Aviso, Cargando, Encabezado, Insignia, Pantalla, Tarjeta, Vacio } from '../components/ui';
import { formatearFecha } from './ApuntesScreen';
import { espaciado, radius } from '../theme/tokens';

export default function ResumenesScreen() {
  const { colores } = useTema();
  const router = useRouter();
  const [lista, setLista] = useState<ResumenDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const todos = await resumenes.listar();
      setLista(todos.filter((r) => r.resumen));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus resúmenes.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // useFocusEffect (y no useEffect) recarga los datos cada vez que se vuelve a esta
  // pestaña, que es justo lo que se busca al regresar desde otra pantalla.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (cargando) return <Pantalla><Cargando texto="Cargando resúmenes…" /></Pantalla>;

  return (
    <Pantalla scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: espaciado.lg, paddingTop: espaciado.sm }}>
        <Encabezado titulo="Mis resúmenes" subtitulo="Generados con IA desde tus apuntes" />

        <Aviso texto={error} onCerrar={() => setError(null)} />

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
            <Vacio
              titulo="Aún no tienes resúmenes"
              mensaje="Abre un apunte y pulsa «Generar resumen»."
            />
          }
          contentContainerStyle={{ paddingBottom: espaciado.xxl, gap: espaciado.md }}
          renderItem={({ item }) => (
            <Tarjeta onPress={() => router.push({ pathname: '/resumen', params: { apunteId: item.apunteId, titulo: item.tituloNota } })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaciado.md }}>
                <View
                  style={{
                    width: 40, height: 40, borderRadius: radius.sm,
                    backgroundColor: `${colores.accent}22`,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>✨</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colores.textPrimary, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                    {item.tituloNota}
                  </Text>
                  {item.fechaRegistro ? (
                    <Text style={{ color: colores.textMuted, fontSize: 12, marginTop: 2 }}>
                      {formatearFecha(item.fechaRegistro)}
                    </Text>
                  ) : null}
                </View>
                <Insignia texto="IA" />
              </View>
            </Tarjeta>
          )}
        />
      </View>
    </Pantalla>
  );
}