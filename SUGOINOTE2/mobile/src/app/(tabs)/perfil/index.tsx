import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BarChart } from 'react-native-chart-kit';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAuth } from '../../../hooks/useAuth';
import { Avatar, Button, Card, Skeleton, ErrorState } from '../../../components/ui';
import { perfil, ErrorApi } from '../../../api/client';

const TEMA_OPCIONES = [
  { valor: 'light', etiqueta: 'Claro', icono: 'sunny-outline' },
  { valor: 'dark', etiqueta: 'Oscuro', icono: 'moon-outline' },
  { valor: 'system', etiqueta: 'Sistema', icono: 'phone-portrait-outline' },
] as const;

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatearFecha(valor?: string | null): string {
  if (!valor) return 'Fecha desconocida';
  try {
    return new Date(valor).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return 'Fecha desconocida';
  }
}

async function elegirImagen(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para cambiar el avatar.');
    return null;
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (resultado.canceled || !resultado.assets[0]?.base64) return null;

  const asset = resultado.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
}

export default function PerfilScreen() {
  const { tokens, preference, setPreference } = useTheme();
  const { logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['perfil'],
    queryFn: perfil.obtener,
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
    }, [queryClient])
  );

  const foto = useMutation({
    mutationFn: (dataUri: string) => perfil.actualizarFoto({ fotoPerfil: dataUri }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['perfil'] });
      await refreshUser();
    },
    onError: (err) => {
      Alert.alert('No se pudo guardar', (err as ErrorApi)?.message ?? 'Inténtalo de nuevo.');
    },
  });

  const cambiarFoto = async () => {
    const dataUri = await elegirImagen();
    if (dataUri) foto.mutate(dataUri);
  };

  const confirmarSalida = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (isLoading && !data) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <View style={styles.content}>
          <Skeleton width="100%" height={140} radius={16} />
          <View style={styles.statsGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width="30%" height={96} radius={16} />
            ))}
          </View>
          <Skeleton width="100%" height={220} radius={16} />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <ErrorState
          title="No se pudo cargar tu perfil"
          message={(error as ErrorApi)?.message ?? 'Inténtalo de nuevo.'}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const anchoGrafico = Math.max(200, width - 68);

  const totales = [
    data.totalApuntes,
    data.totalResumenes,
    data.totalExamenes,
    data.totalPublicaciones,
    data.totalMaterias,
  ];
  const hayActividad = totales.some((v) => v > 0);

  const stats: {
    etiqueta: string;
    valor: string | number;
    icono: React.ComponentProps<typeof Ionicons>['name'];
  }[] = [
    { etiqueta: 'Apuntes', valor: data.totalApuntes, icono: 'document-text-outline' },
    { etiqueta: 'Resúmenes', valor: data.totalResumenes, icono: 'sparkles-outline' },
    { etiqueta: 'Exámenes', valor: data.totalExamenes, icono: 'clipboard-outline' },
    { etiqueta: 'Publicaciones', valor: data.totalPublicaciones, icono: 'chatbubbles-outline' },
    { etiqueta: 'Materias', valor: data.totalMaterias, icono: 'book-outline' },
    {
      etiqueta: 'Promedio',
      valor: data.promedio != null ? data.promedio.toFixed(1) : '—',
      icono: 'trending-up-outline',
    },
  ];

  const chartConfig = {
    backgroundGradientFrom: tokens.bgSurface,
    backgroundGradientTo: tokens.bgSurface,
    decimalPlaces: 0,
    color: (opacity = 1) => rgba(tokens.accent, opacity),
    labelColor: (opacity = 1) => rgba(tokens.textMuted, opacity),
    barPercentage: 0.55,
    propsForBackgroundLines: { stroke: tokens.borderSubtle },
    propsForLabels: { fill: tokens.textMuted, fontSize: 11 },
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tokens.bgApp }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[tokens.accent]} />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>Mi perfil</Text>
        <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
          Gestiona tu información y revisa tu progreso
        </Text>
      </View>

      <Card variant="elevated" style={styles.profileCard}>
        <View style={styles.profileRow}>
          <Pressable
            onPress={cambiarFoto}
            disabled={foto.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
          >
            <Avatar source={data.fotoPerfil ? { uri: data.fotoPerfil } : undefined} name={data.nombreCompleto} size="xl" />
            <View style={[styles.avatarBadge, { backgroundColor: tokens.accent, borderColor: tokens.bgElevated }]}>
              <Ionicons name="camera" size={14} color={tokens.accentContrast} />
            </View>
          </Pressable>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: tokens.textPrimary }]} numberOfLines={1}>
              {data.nombreCompleto}
            </Text>
            <Text style={[styles.profileEmail, { color: tokens.textMuted }]} numberOfLines={1}>
              {data.correoElectronico}
            </Text>
            <Text style={[styles.profileSince, { color: tokens.textMuted }]}>
              Miembro desde {formatearFecha(data.fechaCreacion)}
            </Text>
          </View>
        </View>
        <View style={styles.profileActions}>
          <Button
            title="Editar perfil"
            variant="outline"
            size="sm"
            onPress={() => router.push('/(tabs)/perfil/editar')}
            icon={<Ionicons name="create-outline" size={16} color={tokens.accent} />}
          />
          <Button
            title="Cambiar foto"
            variant="ghost"
            size="sm"
            loading={foto.isPending}
            onPress={cambiarFoto}
            icon={<Ionicons name="image-outline" size={16} color={tokens.accent} />}
          />
        </View>
      </Card>

      <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Estadísticas</Text>
      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <Card key={s.etiqueta} variant="surface" style={styles.statTile}>
            <View style={[styles.statIcon, { backgroundColor: tokens.onSurface05 }]}>
              <Ionicons name={s.icono} size={18} color={tokens.accent} />
            </View>
            <Text style={[styles.statValue, { color: tokens.textPrimary }]}>{s.valor}</Text>
            <Text style={[styles.statLabel, { color: tokens.textMuted }]}>{s.etiqueta}</Text>
          </Card>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Actividad general</Text>
      <Card variant="surface" style={styles.chartCard}>
        {hayActividad ? (
          <BarChart
            data={{
              labels: ['Apuntes', 'Resúm.', 'Exám.', 'Pub.', 'Materias'],
              datasets: [{ data: totales }],
            }}
            width={anchoGrafico}
            height={220}
            fromZero
            withInnerLines
            showValuesOnTopOfBars
            segments={4}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={styles.chart}
          />
        ) : (
          <View style={styles.center}>
            <Ionicons name="bar-chart-outline" size={34} color={tokens.textMuted} />
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
              Aún no hay actividad que mostrar.
            </Text>
          </View>
        )}
      </Card>

      <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Apariencia</Text>
      <Card variant="surface">
        <Text style={[styles.prefLabel, { color: tokens.textMuted }]}>Tema de la aplicación</Text>
        <View style={styles.themeRow}>
          {TEMA_OPCIONES.map((opcion) => {
            const activo = preference === opcion.valor;
            return (
              <Pressable
                key={opcion.valor}
                onPress={() => setPreference(opcion.valor)}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`Tema ${opcion.etiqueta}`}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: activo ? tokens.accentTint : tokens.bgInset,
                    borderColor: activo ? tokens.accent : tokens.borderSubtle,
                  },
                ]}
              >
                <Ionicons
                  name={opcion.icono}
                  size={18}
                  color={activo ? tokens.accent : tokens.textMuted}
                />
                <Text
                  style={[styles.themeText, { color: activo ? tokens.accent : tokens.textSecondary }]}
                >
                  {opcion.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Button
        title="Cerrar sesión"
        variant="danger"
        fullWidth
        onPress={confirmarSalida}
        icon={<Ionicons name="log-out-outline" size={18} color={tokens.accentContrast} />}
        style={styles.logout}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 100, gap: 12 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  profileCard: { padding: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '800' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  profileSince: { fontSize: 12, marginTop: 4 },
  profileActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 8, marginBottom: -2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, padding: 12, alignItems: 'flex-start' },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  chartCard: { padding: 12, alignItems: 'center' },
  chart: { borderRadius: 12, marginLeft: -8 },
  prefLabel: { fontSize: 13, marginBottom: 10 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  themeText: { fontSize: 13, fontWeight: '700' },
  logout: { marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
});
