import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, comunidad } from '../api/client';
import { useTema } from '../context/TemaContext';
import { htmlATexto } from '../utils/html';
import { Avatar } from '../components/chat';
import { Aviso, Boton, Campo, Cargando, Insignia, Pantalla, Tarjeta, estilosComunes } from '../components/ui';
import { formatearFecha } from './ApuntesScreen';
import { espaciado, radius } from '../theme/tokens';

type Post = {
  postId: string;
  titulo: string;
  detalle: string;
  autor: string;
  esEncuesta: boolean;
  soloUnaOpcion: boolean;
  fecha: string | null;
  totalVotos: number;
  opciones: { opcionId: string; texto: string; totalVotos: number; seleccionada: boolean }[];
  respuestas: { respuestaId: string; autor: string; texto: string; fecha: string | null }[];
};

export default function PostScreen({ route }: any) {
  const { colores } = useTema();
  const postId: string = route.params?.postId;

  const [post, setPost] = useState<Post | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votos, setVotos] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPost(await comunidad.obtener(postId));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo abrir la publicación.');
    } finally {
      setCargando(false);
    }
  }, [postId]);

  // useFocusEffect (y no useEffect) recarga los datos cada vez que se vuelve a esta
  // pantalla, que es justo lo que se busca al regresar desde otra.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  function alternar(opcionId: string) {
    if (!post) return;
    setVotos((prev) => {
      if (prev.includes(opcionId)) return prev.filter((x) => x !== opcionId);
      return post.soloUnaOpcion ? [opcionId] : [...prev, opcionId];
    });
  }

  async function votar() {
    if (votos.length === 0) {
      setError('Selecciona al menos una opción.');
      return;
    }
    setEnviando(true);
    try {
      setError(null);
      await comunidad.votar(postId, votos);
      setVotos([]);
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo registrar tu voto.');
    } finally {
      setEnviando(false);
    }
  }

  async function responder() {
    const t = texto.trim();
    if (!t) {
      setError('Escribe una respuesta.');
      return;
    }
    setEnviando(true);
    try {
      setError(null);
      await comunidad.responder(postId, t);
      setTexto('');
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo publicar tu respuesta.');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <Pantalla><Cargando texto="Cargando publicación…" /></Pantalla>;
  if (!post) return <Pantalla><Aviso texto={error ?? 'Publicación no encontrada.'} /></Pantalla>;

  return (
    <Pantalla>
      <Aviso texto={error} onCerrar={() => setError(null)} />

      <View style={{ marginBottom: espaciado.lg }}>
        <View style={[estilosComunes.fila, { marginBottom: espaciado.md }]}>
          <Avatar nombre={post.autor} />
          <Text style={{ color: colores.textSecondary, fontWeight: '600', fontSize: 13 }}>{post.autor}</Text>
          <Text style={{ color: colores.textMuted, fontSize: 11 }}>
            {post.fecha ? `· ${formatearFecha(post.fecha)}` : ''}
          </Text>
        </View>

        <Text style={{ color: colores.textPrimary, fontSize: 22, fontWeight: '800' }}>{post.titulo}</Text>
        {post.detalle ? (
          <Text style={{ color: colores.textSecondary, fontSize: 15, lineHeight: 22, marginTop: espaciado.sm }}>
            {htmlATexto(post.detalle)}
          </Text>
        ) : null}
      </View>

      {post.esEncuesta ? (
        <View style={{ marginBottom: espaciado.xl }}>
          <View style={[estilosComunes.fila, { marginBottom: espaciado.md }]}>
            <Text style={{ color: colores.textPrimary, fontWeight: '700', fontSize: 15 }}>
              {post.totalVotos} votos
            </Text>
            <Insignia texto={post.soloUnaOpcion ? 'Una sola opción' : 'Varias respuestas'} tono="neutro" />
          </View>

          {post.opciones.map((o) => {
            const elegida = votos.includes(o.opcionId);
            const porcentaje = post.totalVotos > 0 ? Math.round((o.totalVotos * 100) / post.totalVotos) : 0;

            return (
              <Pressable key={o.opcionId} onPress={() => alternar(o.opcionId)} style={{ marginBottom: espaciado.sm }}>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: elegida ? colores.accent : colores.borderDefault,
                    backgroundColor: elegida ? `${colores.accent}1f` : 'transparent',
                    borderRadius: radius.sm,
                    padding: 14,
                  }}
                >
                  <View style={estilosComunes.fila}>
                    <Text style={{ color: colores.textPrimary, flex: 1, fontSize: 14 }}>{htmlATexto(o.texto)}</Text>
                    <Text style={{ color: colores.textMuted, fontSize: 12 }}>{o.totalVotos}</Text>
                  </View>
                  {post.totalVotos > 0 ? (
                    <View style={{ height: 5, backgroundColor: colores.bgElevated, borderRadius: 3, marginTop: 8 }}>
                      <View
                        style={{
                          width: `${porcentaje}%`,
                          height: 5,
                          backgroundColor: colores.accent,
                          borderRadius: 3,
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          <View style={{ height: espaciado.md }} />
          <Boton titulo="Votar" onPress={votar} cargando={enviando} ancho />
        </View>
      ) : null}

      <Text style={{ color: colores.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: espaciado.md }}>
        {post.respuestas.length} respuestas
      </Text>

      {post.respuestas.map((r) => (
        <Tarjeta key={r.respuestaId} style={{ marginBottom: espaciado.sm }}>
          <View style={[estilosComunes.fila, { marginBottom: espaciado.sm }]}>
            <Avatar nombre={r.autor} />
            <Text style={{ color: colores.textSecondary, fontWeight: '600', fontSize: 13 }}>{r.autor}</Text>
          </View>
          <Text style={{ color: colores.textPrimary, fontSize: 14, lineHeight: 21 }}>{htmlATexto(r.texto)}</Text>
        </Tarjeta>
      ))}

      <View style={{ marginTop: espaciado.lg }}>
        <Campo
          etiqueta="Tu respuesta"
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe tu respuesta…"
          multiline
        />
        <Boton titulo="Publicar respuesta" onPress={responder} cargando={enviando} variante="secundario" ancho />
      </View>
    </Pantalla>
  );
}