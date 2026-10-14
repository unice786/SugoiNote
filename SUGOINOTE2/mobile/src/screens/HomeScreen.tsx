import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ErrorApi, apuntes } from '../api/client';
import { useSesion } from '../context/AuthContext';
import { useTema } from '../context/TemaContext';
import { Avatar } from '../components/chat';
import { Aviso, Boton, Cargando, Pantalla, Tarjeta } from '../components/ui';
import { espaciado, radius } from '../theme/tokens';

type Acceso = {
  titulo: string;
  icono: string;
  descripcion: string;
  ruta: string;
};

const ACCESOS: Acceso[] = [
  { titulo: 'Apuntes', icono: '📓', descripcion: 'Escribe y organiza tus notas', ruta: '/apuntes' },
  { titulo: 'Resúmenes', icono: '✨', descripcion: 'Resúmenes hechos por la IA', ruta: '/resumenes' },
  { titulo: 'Exámenes', icono: '📝', descripcion: 'Practica y mide tu progreso', ruta: '/examenes' },
  { titulo: 'Chat IA', icono: '💬', descripcion: 'Pregunta lo que quieras', ruta: '/chat' },
  { titulo: 'Comunidad', icono: '👥', descripcion: 'Dudas y encuestas de otros', ruta: '/comunidad' },
  { titulo: 'Perfil', icono: '👤', descripcion: 'Tus datos y estadísticas', ruta: '/perfil' },
];

export default function HomeScreen() {
  const { colores } = useTema();
  const { estudiante } = useSesion();
  const router = useRouter();

  const [ultimos, setUltimos] = useState<{ apunteId: string; tituloNota: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await apuntes.listar();
      setUltimos(lista.slice(0, 3));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor.');
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

  if (cargando) return <Pantalla><Cargando /></Pantalla>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.bgApp }}
      contentContainerStyle={{ padding: espaciado.lg, paddingTop: espaciado.sm, gap: espaciado.xl }}
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
    >
      <Aviso texto={error} onCerrar={() => setError(null)} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaciado.md }}>
        <Avatar nombre={estudiante?.nombreCompleto} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colores.textMuted, fontSize: 13 }}>Hola,</Text>
          <Text style={{ color: colores.textPrimary, fontSize: 20, fontWeight: '800' }}>
            {estudiante?.nombreCompleto?.split(' ')[0] ?? 'estudiante'}
          </Text>
        </View>
      </View>

      <View>
        <Text style={{ color: colores.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: espaciado.md }}>
          ¿Qué quieres hacer?
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaciado.md }}>
          {ACCESOS.map((a) => (
            <Pressable
              key={a.ruta}
              onPress={() => router.push(a.ruta as any)}
              style={({ pressed }) => ({
                width: '48%',
                flexGrow: 1,
                backgroundColor: pressed ? colores.bgSurfaceHover : colores.bgSurface,
                borderWidth: 1,
                borderColor: colores.borderSubtle,
                borderRadius: radius.md,
                padding: espaciado.lg,
                gap: 6,
              })}
            >
              <Text style={{ fontSize: 26 }}>{a.icono}</Text>
              <Text style={{ color: colores.textPrimary, fontWeight: '700', fontSize: 15 }}>{a.titulo}</Text>
              <Text style={{ color: colores.textMuted, fontSize: 12 }}>{a.descripcion}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {ultimos.length > 0 ? (
        <View>
          <Text style={{ color: colores.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: espaciado.md }}>
            Apuntes recientes
          </Text>
          {ultimos.map((a) => (
            <Tarjeta
              key={a.apunteId}
              style={{ marginBottom: espaciado.sm }}
              onPress={() => router.push('/apuntes')}
            >
              <Text style={{ color: colores.textPrimary, fontWeight: '600' }} numberOfLines={1}>
                {a.tituloNota}
              </Text>
            </Tarjeta>
          ))}
        </View>
      ) : (
        <Tarjeta>
          <Text style={{ color: colores.textPrimary, fontWeight: '700', marginBottom: espaciado.sm }}>
            Empieza por tu primer apunte
          </Text>
          <Text style={{ color: colores.textMuted, fontSize: 13, marginBottom: espaciado.lg }}>
            Crea un apunte y pídele a la IA un resumen o un examen.
          </Text>
          <Boton titulo="Ir a mis apuntes" onPress={() => router.push('/apuntes')} ancho />
        </Tarjeta>
      )}
    </ScrollView>
  );
}