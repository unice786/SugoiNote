import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, useToast } from '../../../components/ui';
import { apuntes, ErrorApi } from '../../../api/client';

export default function NuevoApunteScreen() {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [titulo, setTitulo] = useState('');
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [crearMateria, setCrearMateria] = useState(false);
  const [nuevaMateria, setNuevaMateria] = useState('');
  const [error, setError] = useState<string | undefined>();

  const { data: materias } = useQuery({
    queryKey: ['materias'],
    queryFn: apuntes.materias,
  });

  const crear = useMutation({
    mutationFn: () =>
      apuntes.crear({
        tituloNota: titulo.trim(),
        materiaId: crearMateria ? null : materiaId,
        nuevaMateriaNombre: crearMateria ? nuevaMateria.trim() : null,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['apuntes'] });
      queryClient.invalidateQueries({ queryKey: ['materias'] });
      toast.success('Apunte creado');
      router.replace(`/(tabs)/apuntes/${res.apunteId}`);
    },
    onError: (err) => {
      setError((err as ErrorApi).message);
    },
  });

  const enviar = () => {
    setError(undefined);
    if (!titulo.trim()) {
      setError('Escribe un título para el apunte.');
      return;
    }
    if (crearMateria && !nuevaMateria.trim()) {
      setError('Escribe el nombre de la nueva materia.');
      return;
    }
    crear.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.bgApp }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={tokens.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>Nuevo apunte</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label="Título"
          placeholder="Ej. Resumen de álgebra lineal"
          value={titulo}
          onChangeText={setTitulo}
          autoFocus
          maxLength={200}
          error={error && !titulo.trim() ? error : undefined}
        />

        <Text style={[styles.label, { color: tokens.textSecondary }]}>Materia</Text>

        <View style={styles.chips}>
          {(materias ?? []).map((m) => {
            const activo = !crearMateria && materiaId === m.materiaId;
            return (
              <Pressable
                key={m.materiaId}
                onPress={() => {
                  setCrearMateria(false);
                  setMateriaId(activo ? null : m.materiaId);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: activo ? tokens.accent : tokens.bgSurface,
                    borderColor: activo ? tokens.accent : tokens.borderDefault,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: activo ? tokens.accentContrast : tokens.textSecondary },
                  ]}
                >
                  {m.nombreMateria}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setCrearMateria((v) => !v)}
            style={[
              styles.chip,
              {
                backgroundColor: crearMateria ? tokens.accent : tokens.bgSurface,
                borderColor: crearMateria ? tokens.accent : tokens.borderDefault,
              },
            ]}
          >
            <Ionicons
              name="add"
              size={16}
              color={crearMateria ? tokens.accentContrast : tokens.textSecondary}
            />
            <Text
              style={[
                styles.chipText,
                { color: crearMateria ? tokens.accentContrast : tokens.textSecondary },
              ]}
            >
              Nueva materia
            </Text>
          </Pressable>
        </View>

        {crearMateria && (
          <Input
            containerStyle={styles.nuevaMateria}
            placeholder="Nombre de la nueva materia"
            value={nuevaMateria}
            onChangeText={setNuevaMateria}
            autoFocus
            maxLength={100}
            error={error && !nuevaMateria.trim() ? error : undefined}
          />
        )}

        {error && (titulo.trim() && (!crearMateria || nuevaMateria.trim())) ? (
          <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text>
        ) : null}

        <Button
          title="Crear apunte"
          onPress={enviar}
          loading={crear.isPending}
          fullWidth
          style={styles.submit}
        />
        <Text style={[styles.hint, { color: tokens.textMuted }]}>
          Se abrirá el editor para que escribas el contenido.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  content: { padding: 18, paddingBottom: 60, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  nuevaMateria: { marginTop: 12 },
  error: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  submit: { marginTop: 16 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 10 },
});
