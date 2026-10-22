import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAuth } from '../../../hooks/useAuth';
import { Button, Input, Spinner, ErrorState, useToast } from '../../../components/ui';
import { perfil, ErrorApi } from '../../../api/client';

export default function EditarPerfilScreen() {
  const { tokens } = useTheme();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['perfil'],
    queryFn: perfil.obtener,
  });

  return (
    <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
      <View style={[styles.header, { borderBottomColor: tokens.borderSubtle }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={tokens.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>Editar perfil</Text>
        <View style={styles.iconBtn} />
      </View>

      {isLoading && !data ? (
        <View style={styles.center}>
          <Spinner size="lg" label="Cargando tu perfil..." />
        </View>
      ) : error || !data ? (
        <ErrorState
          title="No se pudo cargar tu perfil"
          message={(error as ErrorApi)?.message ?? 'Inténtalo de nuevo.'}
          onRetry={() => refetch()}
        />
      ) : (
        <EditarPerfilForm
          nombreInicial={data.nombreCompleto}
          correoInicial={data.correoElectronico}
        />
      )}
    </View>
  );
}

function EditarPerfilForm({
  nombreInicial,
  correoInicial,
}: {
  nombreInicial: string;
  correoInicial: string;
}) {
  const { tokens } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const [nombre, setNombre] = useState(nombreInicial);
  const [correo, setCorreo] = useState(correoInicial);

  const guardar = useMutation({
    mutationFn: () =>
      perfil.actualizar({ nombreCompleto: nombre.trim(), correo: correo.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['perfil'] });
      await refreshUser();
      toast.success('Perfil actualizado');
      router.back();
    },
    onError: (err) => {
      toast.error((err as ErrorApi)?.message ?? 'No se pudo actualizar el perfil.');
    },
  });

  const valido = nombre.trim().length >= 2 && correo.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.help, { color: tokens.textMuted }]}>
          Actualiza tu nombre y correo. Si cambias el correo, úsalo la próxima vez que inicies sesión.
        </Text>
        <Input
          label="Nombre completo"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre"
          autoCapitalize="words"
        />
        <Input
          label="Correo electrónico"
          value={correo}
          onChangeText={setCorreo}
          placeholder="tucorreo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          title="Guardar cambios"
          fullWidth
          loading={guardar.isPending}
          disabled={!valido}
          onPress={() => guardar.mutate()}
        />
        <Button title="Cancelar" variant="ghost" fullWidth onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, gap: 14 },
  help: { fontSize: 13, lineHeight: 19 },
});
