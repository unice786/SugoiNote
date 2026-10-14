import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, examenes } from '../api/client';
import { useTema } from '../context/TemaContext';
import { htmlATexto } from '../utils/html';
import { Aviso, Boton, Cargando, Pantalla, Tarjeta, estilosComunes } from '../components/ui';
import { espaciado, radius } from '../theme/tokens';

type Examen = {
  examenId: string;
  tituloApunte: string;
  calificado: boolean;
  nota: number | null;
  preguntas: {
    preguntaId: string;
    texto: string;
    respuestaSeleccionadaId: string | null;
    opciones: { opcionId: string; texto: string; esLaCorrecta: boolean }[];
  }[];
};

export default function ExamenVerScreen({ route }: any) {
  const { colores } = useTema();
  const examenId: string = route.params?.examenId;

  const [examen, setExamen] = useState<Examen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setExamen(await examenes.obtener(examenId));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo abrir el examen.');
    } finally {
      setCargando(false);
    }
  }, [examenId]);

  // useFocusEffect (y no useEffect) recarga los datos cada vez que se vuelve a esta
  // pantalla, que es justo lo que se busca al regresar desde otra.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  function elegir(preguntaId: string, opcionId: string) {
    setElegidas((prev) => ({ ...prev, [preguntaId]: opcionId }));
  }

  async function entregar() {
    if (!examen) return;

    const respondidas = Object.keys(elegidas).length;
    if (respondidas < examen.preguntas.length) {
      setError(`Faltan ${examen.preguntas.length - respondidas} pregunta(s) por responder.`);
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await examenes.calificar(examenId, elegidas);
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo entregar el examen.');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <Pantalla><Cargando texto="Cargando examen…" /></Pantalla>;
  if (!examen) return <Pantalla><Aviso texto={error ?? 'Examen no encontrado.'} /></Pantalla>;

  const calificado = examen.calificado;

  return (
    <Pantalla>
      <View style={{ marginBottom: espaciado.lg }}>
        <Text style={{ color: colores.textPrimary, fontSize: 22, fontWeight: '800' }}>
          {examen.tituloApunte}
        </Text>
        <Text style={{ color: colores.textMuted, fontSize: 13, marginTop: 4 }}>
          {examen.preguntas.length} pregunta(s)
        </Text>
      </View>

      <Aviso texto={error} onCerrar={() => setError(null)} />

      {calificado ? (
        <Tarjeta style={{ marginBottom: espaciado.lg, alignItems: 'center', paddingVertical: espaciado.xl }}>
          <Text style={{ color: colores.textPrimary, fontSize: 44, fontWeight: '800' }}>{examen.nota}%</Text>
          <Text
            style={{
              color: (examen.nota ?? 0) >= 70 ? colores.success : (examen.nota ?? 0) >= 50 ? colores.warning : colores.danger,
              fontWeight: '700',
              marginTop: 4,
            }}
          >
            {(examen.nota ?? 0) >= 70 ? 'Aprobado' : (examen.nota ?? 0) >= 50 ? 'Regular' : 'Reprobado'}
          </Text>
        </Tarjeta>
      ) : null}

      {examen.preguntas.map((p, i) => (
        <View key={p.preguntaId} style={{ marginBottom: espaciado.xl }}>
          <View style={[estilosComunes.fila, { marginBottom: espaciado.md }]}>
            <View
              style={{
                backgroundColor: `${colores.accent}22`,
                borderRadius: radius.sm,
                paddingHorizontal: 9,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: colores.accent, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
            </View>
            <Text style={{ color: colores.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 }}>
              {htmlATexto(p.texto)}
            </Text>
          </View>

          {p.opciones.map((o) => {
            const elegida = elegidas[p.preguntaId] === o.opcionId;
            const marcada = p.respuestaSeleccionadaId === o.opcionId;

            let fondo = 'transparent';
            let borde = colores.borderDefault;
            let texto = colores.textPrimary;

            if (calificado) {
              if (o.esLaCorrecta) {
                fondo = `${colores.success}1f`;
                borde = `${colores.success}66`;
                texto = colores.success;
              } else if (marcada) {
                fondo = `${colores.danger}1f`;
                borde = `${colores.danger}66`;
                texto = colores.danger;
              } else {
                texto = colores.textMuted;
              }
            } else if (elegida) {
              fondo = `${colores.accent}1f`;
              borde = `${colores.accent}66`;
              texto = colores.accent;
            }

            return (
              <Pressable
                key={o.opcionId}
                disabled={calificado}
                onPress={() => elegir(p.preguntaId, o.opcionId)}
                style={{
                  backgroundColor: fondo,
                  borderColor: borde,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  padding: 14,
                  marginTop: espaciado.sm,
                }}
              >
                <View style={estilosComunes.fila}>
                  <View
                    style={{
                      width: 18, height: 18, borderRadius: 9,
                      borderWidth: 2, borderColor: elegida || marcada ? texto : colores.borderDefault,
                      backgroundColor: elegida || marcada ? texto : 'transparent',
                    }}
                  />
                  <Text style={{ color: texto, fontSize: 14, flex: 1 }}>{htmlATexto(o.texto)}</Text>
                  {calificado && o.esLaCorrecta ? <Text style={{ color: colores.success }}>✓</Text> : null}
                  {calificado && marcada && !o.esLaCorrecta ? <Text style={{ color: colores.danger }}>✕</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {!calificado ? (
        <Boton titulo="Entregar examen" onPress={entregar} cargando={enviando} ancho />
      ) : null}
    </Pantalla>
  );
}