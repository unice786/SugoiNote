import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ErrorApi, PostDto, comunidad } from '../api/client';
import { useTema } from '../context/TemaContext';
import { Aviso, Boton, Campo, Cargando, Encabezado, Insignia, ModalSimple, Pantalla, Tarjeta, Vacio } from '../components/ui';
import { formatearFecha } from './ApuntesScreen';
import { espaciado } from '../theme/tokens';

export default function ComunidadScreen() {
  const { colores } = useTema();
  const router = useRouter();

  const [lista, setLista] = useState<PostDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<'ninguno' | 'post' | 'encuesta'>('ninguno');
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [opciones, setOpciones] = useState(['', '', '', '']);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLista(await comunidad.listar());
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la comunidad.');
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

  function cerrarModal() {
    setModal('ninguno');
    setTitulo('');
    setDetalle('');
    setOpciones(['', '', '', '']);
    setError(null);
  }

  async function publicar() {
    setEnviando(true);
    try {
      setError(null);

      if (modal === 'post') {
        await comunidad.crearPost(titulo.trim(), detalle.trim());
      } else {
        const limpias = opciones.map((o) => o.trim()).filter(Boolean);
        if (limpias.length < 2) {
          setError('La encuesta necesita al menos 2 opciones.');
          setEnviando(false);
          return;
        }
        await comunidad.crearEncuesta(titulo.trim(), detalle.trim(), limpias, true);
      }

      cerrarModal();
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo publicar.');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <Pantalla><Cargando texto="Cargando comunidad…" /></Pantalla>;

  return (
    <Pantalla scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: espaciado.lg, paddingTop: espaciado.sm }}>
        <Encabezado
          titulo="Comunidad"
          subtitulo="Preguntas y encuestas de otros estudiantes"
          derecha={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton titulo="✏️" variante="secundario" onPress={() => setModal('post')} />
              <Boton titulo="📊" variante="secundario" onPress={() => setModal('encuesta')} />
            </View>
          }
        />

        <Aviso texto={error} onCerrar={() => setError(null)} />

        <FlatList
          data={lista}
          keyExtractor={(x) => x.postId}
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
            <Vacio titulo="Todavía no hay publicaciones" mensaje="Sé la primera persona en preguntar algo." />
          }
          contentContainerStyle={{ paddingBottom: espaciado.xxl, gap: espaciado.md }}
          renderItem={({ item }) => (
            <Tarjeta onPress={() => router.push({ pathname: '/post', params: { postId: item.postId } })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaciado.sm }}>
                <View
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: `${colores.accent}22`,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colores.accent, fontWeight: '800', fontSize: 13 }}>
                    {item.autor.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: colores.textSecondary, fontWeight: '600', fontSize: 13 }}>
                  {item.autor}
                </Text>
                <Text style={{ color: colores.textMuted, fontSize: 11 }}>
                  {item.fecha ? `· ${formatearFecha(item.fecha)}` : ''}
                </Text>
              </View>

              <Text style={{ color: colores.textPrimary, fontWeight: '700', fontSize: 15, marginTop: espaciado.md }}>
                {item.titulo}
              </Text>
              <Text style={{ color: colores.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                {item.detalle}
              </Text>

              <View style={{ flexDirection: 'row', gap: 6, marginTop: espaciado.md, alignItems: 'center' }}>
                {item.esEncuesta ? <Insignia texto="Encuesta" /> : null}
                <Text style={{ color: colores.textMuted, fontSize: 12 }}>
                  {item.esEncuesta ? `${item.totalVotos} votos` : `${item.totalRespuestas} respuestas`}
                </Text>
              </View>
            </Tarjeta>
          )}
        />
      </View>

      <ModalSimple
        visible={modal !== 'ninguno'}
        titulo={modal === 'post' ? 'Nueva pregunta' : 'Nueva encuesta'}
        onCerrar={cerrarModal}
      >
        <Campo etiqueta="Título" value={titulo} onChangeText={setTitulo} placeholder="¿Sobre qué preguntas?" />

        <Campo
          etiqueta="Detalle"
          value={detalle}
          onChangeText={setDetalle}
          placeholder="Cuéntanos un poco más…"
          multiline
        />

        {modal === 'encuesta' ? (
          opciones.map((o, i) => (
            <Campo
              key={i}
              etiqueta={`Opción ${i + 1}`}
              value={o}
              onChangeText={(v) => {
                const copia = [...opciones];
                copia[i] = v;
                setOpciones(copia);
              }}
              placeholder={`Opción ${i + 1}`}
            />
          ))
        ) : null}

        <Boton titulo="Publicar" onPress={publicar} cargando={enviando} ancho />
      </ModalSimple>
    </Pantalla>
  );
}