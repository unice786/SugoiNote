import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, perfil } from '../api/client';
import { useSesion } from '../context/AuthContext';
import { useTema, Preferencia } from '../context/TemaContext';
import { Avatar } from '../components/chat';
import { Aviso, Boton, Campo, Cargando, Encabezado, Pantalla, Tarjeta, estilosComunes } from '../components/ui';
import { espaciado, radius } from '../theme/tokens';

export default function PerfilScreen() {
  const { colores, preferencia, setPreferencia, tema } = useTema();
  const { estudiante, cerrarSesion } = useSesion();

  const [stats, setStats] = useState<{ apuntes: number; resumenes: number; examenes: number; publicaciones: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const p = await perfil.obtener();
      setError(null);
      setStats({
        apuntes: p.totalApuntes ?? 0,
        resumenes: p.totalResumenes ?? 0,
        examenes: p.totalExamenes ?? 0,
        publicaciones: p.totalPublicaciones ?? 0,
      });
      if (p.nombreCompleto) setNombre(p.nombreCompleto);
      if (p.correoElectronico) setCorreo(p.correoElectronico);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar tu perfil.');
    } finally {
      setCargando(false);
    }
  }, []);

  // useFocusEffect (y no useEffect) recarga los datos cada vez que se vuelve a esta
  // pantalla, que es justo lo que se busca al regresar desde otra.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function guardar() {
    setGuardando(true);
    try {
      setError(null);
      await perfil.actualizar(nombre.trim(), correo.trim());
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <Pantalla><Cargando texto="Cargando perfil…" /></Pantalla>;

  return (
    <Pantalla>
      <Encabezado titulo="Mi perfil" />

      <Aviso texto={error} onCerrar={() => setError(null)} />

      <Tarjeta style={{ alignItems: 'center', marginBottom: espaciado.lg }}>
        <Avatar nombre={estudiante?.nombreCompleto} />
        <Text style={{ color: colores.textPrimary, fontWeight: '800', fontSize: 18, marginTop: espaciado.md }}>
          {estudiante?.nombreCompleto ?? 'Estudiante'}
        </Text>
        <Text style={{ color: colores.textMuted, fontSize: 13 }}>{estudiante?.correoElectronico}</Text>
      </Tarjeta>

      {stats ? (
        <View style={{ flexDirection: 'row', gap: espaciado.md, marginBottom: espaciado.xl }}>
          <Estadistica valor={stats.apuntes} etiqueta="Apuntes" />
          <Estadistica valor={stats.resumenes} etiqueta="Resúmenes" />
          <Estadistica valor={stats.examenes} etiqueta="Exámenes" />
          <Estadistica valor={stats.publicaciones} etiqueta="Comunidad" />
        </View>
      ) : null}

      <Text style={{ color: colores.textPrimary, fontWeight: '700', marginBottom: espaciado.md }}>
        Apariencia
      </Text>
      <Tarjeta style={{ marginBottom: espaciado.xl }}>
        <FilaOpciones
          etiqueta="Tema"
          valor={preferencia === 'auto' ? 'Automático' : preferencia === 'oscuro' ? 'Oscuro' : 'Claro'}
        >
          {(['claro', 'auto', 'oscuro'] as Preferencia[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPreferencia(p)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.sm,
                backgroundColor: preferencia === p ? colores.accent : colores.bgElevated,
              }}
            >
              <Text style={{ color: preferencia === p ? '#fff' : colores.textMuted, fontWeight: '700', fontSize: 12 }}>
                {p === 'claro' ? 'Claro' : p === 'oscuro' ? 'Oscuro' : 'Auto'}
              </Text>
            </Pressable>
          ))}
        </FilaOpciones>
        <Text style={{ color: colores.textMuted, fontSize: 11, marginTop: espaciado.sm }}>
          Ahora mismo: {tema}
        </Text>
      </Tarjeta>

      <Text style={{ color: colores.textPrimary, fontWeight: '700', marginBottom: espaciado.md }}>
        Datos personales
      </Text>
      <Tarjeta style={{ marginBottom: espaciado.xl }}>
        <Campo etiqueta="Nombre completo" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
        <Campo
          etiqueta="Correo electrónico"
          value={correo}
          onChangeText={setCorreo}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Boton titulo="Guardar cambios" onPress={guardar} cargando={guardando} ancho />
      </Tarjeta>

      <Boton titulo="Cerrar sesión" onPress={cerrarSesion} variante="peligro" ancho />
    </Pantalla>
  );
}

function Estadistica({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const { colores } = useTema();
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colores.bgSurface, borderRadius: radius.md, paddingVertical: espaciado.md, borderWidth: 1, borderColor: colores.borderSubtle }}>
      <Text style={{ color: colores.textPrimary, fontSize: 20, fontWeight: '800' }}>{valor}</Text>
      <Text style={{ color: colores.textMuted, fontSize: 11 }}>{etiqueta}</Text>
    </View>
  );
}

function FilaOpciones({ etiqueta, valor, children }: { etiqueta: string; valor?: string; children: React.ReactNode }) {
  const { colores } = useTema();
  return (
    <View>
      <View style={estilosComunes.fila}>
        <Text style={{ color: colores.textSecondary, fontSize: 14, flex: 1 }}>{etiqueta}</Text>
        {valor ? <Text style={{ color: colores.textMuted, fontSize: 13 }}>{valor}</Text> : null}
      </View>
      <View style={[estilosComunes.fila, { marginTop: espaciado.md }]}>{children}</View>
    </View>
  );
}