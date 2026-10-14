import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ErrorApi, ExamenResumenDto, examenes } from '../api/client';
import { useTema } from '../context/TemaContext';
import { Aviso, Cargando, Encabezado, Insignia, Pantalla, Tarjeta, Vacio } from '../components/ui';
import { formatearFecha } from './ApuntesScreen';
import { espaciado, radius } from '../theme/tokens';

export default function ExamenesScreen() {
  const { colores } = useTema();
  const router = useRouter();
  const [lista, setLista] = useState<ExamenResumenDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLista(await examenes.listar());
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus exámenes.');
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

  if (cargando) return <Pantalla><Cargando texto="Cargando exámenes…" /></Pantalla>;

  return (
    <Pantalla scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: espaciado.lg, paddingTop: espaciado.sm }}>
        <Encabezado titulo="Exámenes" subtitulo="Generados con IA desde tus apuntes" />

        <Aviso texto={error} onCerrar={() => setError(null)} />

        <FlatList
          data={lista}
          keyExtractor={(x) => x.examenId}
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
              titulo="Aún no tienes exámenes"
              mensaje="Abre un apunte y pulsa «Generar examen»."
            />
          }
          contentContainerStyle={{ paddingBottom: espaciado.xxl, gap: espaciado.md }}
          renderItem={({ item }) => {
            const nota = item.nota ?? 0;
            const entregado = item.nota !== null && item.nota !== undefined;
            const tono = !entregado ? 'neutro' : nota >= 70 ? 'exito' : nota >= 50 ? 'acento' : 'peligro';

            return (
              <Tarjeta onPress={() => router.push({ pathname: '/examen', params: { examenId: item.examenId } })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaciado.md }}>
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: radius.sm,
                      backgroundColor: `${colores.accent}22`,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>📝</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colores.textPrimary, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                      {item.tituloApunte}
                    </Text>
                    <Text style={{ color: colores.textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.total} pregunta(s){item.fecha ? ` · ${formatearFecha(item.fecha)}` : ''}
                    </Text>
                  </View>

                  {entregado ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: colores.textPrimary, fontSize: 20, fontWeight: '800' }}>
                        {nota}%
                      </Text>
                      <Insignia texto="Entregado" tono={tono as any} />
                    </View>
                  ) : (
                    <Insignia texto="Pendiente" tono="neutro" />
                  )}
                </View>
              </Tarjeta>
            );
          }}
        />
      </View>
    </Pantalla>
  );
}