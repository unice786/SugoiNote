import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ApunteDto, ErrorApi, apuntes, examenes, resumenes } from '../api/client';
import { useTema } from '../context/TemaContext';
import { htmlATexto } from '../utils/html';
import { Aviso, Boton, Cargando, Insignia, Pantalla, estilosComunes } from '../components/ui';
import { espaciado, radius } from '../theme/tokens';

const ESPERA_AUTOGUARDADO = 1200;

export default function EditorScreen({ route }: any) {
  const { colores } = useTema();
  const router = useRouter();
  const apunteId: string = route.params?.apunteId;

  const [cargando, setCargando] = useState(true);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Se guarda el último contenido enviado para no repetir la misma escritura.
  const ultimoGuardado = useRef<{ titulo: string; contenido: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const a: ApunteDto = await apuntes.obtener(apunteId);
      setError(null);
      setTitulo(a.tituloNota);
      setContenido(htmlATexto(a.contenidoTexto ?? ''));
      ultimoGuardado.current = { titulo: a.tituloNota, contenido: htmlATexto(a.contenidoTexto ?? '') };
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo abrir el apunte.');
    } finally {
      setCargando(false);
    }
  }, [apunteId]);

  // useFocusEffect (y no useEffect) recarga los datos cada vez que se vuelve a esta
  // pantalla, que es justo lo que se busca al regresar desde otra.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const guardar = useCallback(
    async (t: string, c: string) => {
      if (ultimoGuardado.current &&
          ultimoGuardado.current.titulo === t &&
          ultimoGuardado.current.contenido === c) {
        return;
      }

      setGuardando(true);
      try {
        await apuntes.autoguardar(apunteId, t, c);
        ultimoGuardado.current = { titulo: t, contenido: c };
        setAviso('Guardado');
        setTimeout(() => setAviso(null), 1500);
      } catch (e) {
        setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.');
      } finally {
        setGuardando(false);
      }
    },
    [apunteId],
  );

  // Autoguardado con retardo: no se manda una petición por cada tecla.
  function alCambiar(tituloNuevo: string, contenidoNuevo: string) {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      guardar(tituloNuevo, contenidoNuevo);
    }, ESPERA_AUTOGUARDADO);
  }

  async function generarResumen() {
    await guardar(titulo, contenido);
    setOcupado('Generando resumen…');
    try {
      await resumenes.generar(apunteId);
      router.push({ pathname: '/resumen', params: { apunteId, titulo } });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo generar el resumen.');
    } finally {
      setOcupado(null);
    }
  }

  async function generarExamen() {
    await guardar(titulo, contenido);
    setOcupado('Generando examen…');
    try {
      const r = await examenes.generar(apunteId, 'opcion_multiple', 5);
      router.push({ pathname: '/examen', params: { examenId: r.examenId } });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo generar el examen.');
    } finally {
      setOcupado(null);
    }
  }

  if (cargando) return <Pantalla><Cargando texto="Abriendo apunte…" /></Pantalla>;

  return (
    <Pantalla scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: espaciado.lg }}>
        <Aviso texto={error} onCerrar={() => setError(null)} />

        <TextInput
          value={titulo}
          onChangeText={(t) => {
            setTitulo(t);
            alCambiar(t, contenido);
          }}
          placeholder="Sin título…"
          placeholderTextColor={colores.textMuted}
          style={{
            color: colores.textPrimary,
            fontSize: 22,
            fontWeight: '800',
            marginBottom: espaciado.md,
          }}
        />

        <View style={estilosComunes.fila}>
          <Insignia texto={guardando ? 'Guardando…' : aviso ?? 'Autoguardado activo'} tono={guardando ? 'neutro' : 'exito'} />
        </View>

        <TextInput
          value={contenido}
          onChangeText={(c) => {
            setContenido(c);
            alCambiar(titulo, c);
          }}
          placeholder="Escribe aquí tu apunte…"
          placeholderTextColor={colores.textMuted}
          multiline
          textAlignVertical="top"
          style={{
            flex: 1,
            color: colores.textPrimary,
            fontSize: 16,
            lineHeight: 24,
            backgroundColor: colores.bgSurface,
            borderWidth: 1,
            borderColor: colores.borderSubtle,
            borderRadius: radius.md,
            padding: espaciado.lg,
            marginTop: espaciado.md,
          }}
        />

        <View style={[estilosComunes.fila, { paddingVertical: espaciado.lg, flexWrap: 'wrap' }]}>
          <Boton titulo="Generar resumen" onPress={generarResumen} variante="secundario" />
          <Boton titulo="Generar examen" onPress={generarExamen} variante="secundario" />
        </View>
      </View>

      {ocupado ? (
        <View
          style={{
            position: 'absolute',
            left: 0, right: 0, top: 0, bottom: 0,
            backgroundColor: '#0008',
            alignItems: 'center',
            justifyContent: 'center',
            gap: espaciado.md,
          }}
        >
          <Cargando texto={ocupado} />
          <Pressable onPress={() => setOcupado(null)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}
    </Pantalla>
  );
}