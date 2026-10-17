import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Spinner, useToast } from '../../../components/ui';
import { examenes, ErrorApi, ExamenPreguntaDto } from '../../../api/client';

function colorNota(nota: number, success: string, warning: string, danger: string) {
  if (nota >= 70) return success;
  if (nota >= 50) return warning;
  return danger;
}

function etiquetaNota(nota: number) {
  if (nota >= 70) return 'Aprobado';
  if (nota >= 50) return 'Regular';
  return 'Reprobado';
}

export default function ExamenDetalleScreen() {
  const { tokens } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { examenId } = useLocalSearchParams<{ examenId: string }>();

  const [respuestas, setRespuestas] = useState<Record<string, string>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['examen', examenId],
    queryFn: () => examenes.obtener(examenId),
    enabled: !!examenId,
  });

  const calificar = useMutation({
    mutationFn: () => examenes.calificar(examenId, { respuestas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examen', examenId] });
      queryClient.invalidateQueries({ queryKey: ['examenes'] });
      toast.success('Examen calificado');
    },
    onError: (err) => toast.error((err as ErrorApi).message),
  });

  const preguntas: ExamenPreguntaDto[] = useMemo(() => data?.preguntas ?? [], [data]);
  const respondidas = Object.keys(respuestas).length;
  const acerto = (p: ExamenPreguntaDto) =>
    !!p.respuestaSeleccionadaId &&
    p.opciones.some((o) => o.opcionId === p.respuestaSeleccionadaId && o.esLaCorrecta);

  const seleccionar = (preguntaId: string, opcionId: string) =>
    setRespuestas((prev) => ({ ...prev, [preguntaId]: opcionId }));

  const entregar = () => {
    if (respondidas < preguntas.length) {
      toast.error(`Faltan ${preguntas.length - respondidas} pregunta(s) por responder`);
      return;
    }
    calificar.mutate();
  };

  const notaColor = data?.nota != null
    ? colorNota(data.nota, tokens.success, tokens.warning, tokens.danger)
    : tokens.accent;

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
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
          {data?.tituloApunte || 'Examen'}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Spinner size="lg" label="Cargando examen..." />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            No se pudo cargar el examen
          </Text>
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            {(error as ErrorApi).message}
          </Text>
          <Button title="Reintentar" onPress={() => refetch()} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {data?.calificado ? (
              <View
                style={[
                  styles.resultado,
                  { backgroundColor: tokens.bgSurface, borderColor: notaColor },
                ]}
              >
                <Text style={[styles.notaBig, { color: notaColor }]}>{data.nota}%</Text>
                <Text style={[styles.notaLabel, { color: notaColor }]}>
                  {data.nota != null ? etiquetaNota(data.nota) : ''}
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: tokens.success }]}>
                      {preguntas.filter(acerto).length}
                    </Text>
                    <Text style={[styles.statLabel, { color: tokens.textMuted }]}>Correctas</Text>
                  </View>
                  <View style={[styles.vDiv, { backgroundColor: tokens.borderSubtle }]} />
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: tokens.danger }]}>
                      {preguntas.filter((p) => !acerto(p)).length}
                    </Text>
                    <Text style={[styles.statLabel, { color: tokens.textMuted }]}>Incorrectas</Text>
                  </View>
                  <View style={[styles.vDiv, { backgroundColor: tokens.borderSubtle }]} />
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: tokens.textPrimary }]}>
                      {preguntas.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: tokens.textMuted }]}>Total</Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={[styles.hint, { color: tokens.textMuted }]}>
                {preguntas.length} preguntas · Responde todas y entrega para ver tu nota.
              </Text>
            )}

            {preguntas.map((preg, i) => {
              const acierto = acerto(preg);
              return (
                <View
                  key={preg.preguntaId}
                  style={[
                    styles.question,
                    { backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle },
                  ]}
                >
                  <View style={styles.questionHead}>
                    <View style={[styles.numero, { backgroundColor: tokens.onSurface06 }]}>
                      <Text style={[styles.numeroText, { color: tokens.accent }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.questionText, { color: tokens.textPrimary }]}>
                      {preg.texto}
                    </Text>
                    {data?.calificado ? (
                      <Ionicons
                        name={acierto ? 'checkmark-circle' : 'close-circle'}
                        size={20}
                        color={acierto ? tokens.success : tokens.danger}
                      />
                    ) : null}
                  </View>

                  <View style={styles.options}>
                    {preg.opciones.map((op) => {
                      const elegida = respuestas[preg.preguntaId] === op.opcionId;
                      const seleccionadaPrevia = preg.respuestaSeleccionadaId === op.opcionId;

                      let borderColor = tokens.borderDefault;
                      let bg = 'transparent';
                      let color = tokens.textPrimary;
                      let icono: 'checkmark-circle' | 'close-circle' | null = null;

                      if (data?.calificado) {
                        if (op.esLaCorrecta) {
                          borderColor = tokens.success;
                          bg = tokens.successSoft + '1a';
                          color = tokens.success;
                          icono = 'checkmark-circle';
                        } else if (seleccionadaPrevia) {
                          borderColor = tokens.danger;
                          bg = tokens.dangerSoft + '1a';
                          color = tokens.danger;
                          icono = 'close-circle';
                        }
                      } else if (elegida) {
                        borderColor = tokens.accent;
                        bg = tokens.onSurface05;
                        color = tokens.accent;
                      }

                      return (
                        <Pressable
                          key={op.opcionId}
                          disabled={data?.calificado}
                          onPress={() => seleccionar(preg.preguntaId, op.opcionId)}
                          style={[styles.option, { borderColor, backgroundColor: bg }]}
                        >
                          <Text style={[styles.optionText, { color }]}>{op.texto}</Text>
                          {icono ? (
                            <Ionicons name={icono} size={18} color={color} />
                          ) : (
                            <Ionicons
                              name={elegida ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={elegida ? tokens.accent : tokens.textMuted}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {data && !data.calificado ? (
            <View
              style={[
                styles.footer,
                { backgroundColor: tokens.bgSurface, borderTopColor: tokens.borderSubtle },
              ]}
            >
              <Text style={[styles.footerCount, { color: tokens.textMuted }]}>
                {respondidas} de {preguntas.length} respondidas
              </Text>
              <Button
                title="Entregar examen"
                onPress={entregar}
                loading={calificar.isPending}
                disabled={respondidas === 0}
                style={{ backgroundColor: tokens.success }}
                icon={<Ionicons name="send" size={16} color={tokens.accentContrast} />}
              />
            </View>
          ) : null}
        </>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  resultado: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  notaBig: { fontSize: 30, fontWeight: '900' },
  notaLabel: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 14,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  vDiv: { width: 1, height: 34 },
  hint: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  question: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  questionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  numero: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroText: { fontSize: 13, fontWeight: '800' },
  questionText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
  },
  footerCount: { fontSize: 13, fontWeight: '600' },
});
