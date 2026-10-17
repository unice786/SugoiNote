import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Spinner, useToast } from '../../../components/ui';
import { resumenes, ErrorApi } from '../../../api/client';
import { documentoResumen } from '../../../utils/resumenHtml';

export default function ResumenDetalleScreen() {
  const { tokens } = useTheme();
  const toast = useToast();
  const { apunteId } = useLocalSearchParams<{ apunteId: string }>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['resumen', apunteId],
    queryFn: () => resumenes.obtener(apunteId),
    enabled: !!apunteId,
  });

  const html = useMemo(
    () => (data ? documentoResumen(data.tituloNota, data.resumen ?? '', tokens, false) : ''),
    [data, tokens]
  );

  const exportarPdf = async () => {
    if (!data) return;
    try {
      const htmlImpresion = documentoResumen(data.tituloNota, data.resumen ?? '', tokens, true);
      const { uri } = await Print.printToFileAsync({ html: htmlImpresion });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir resumen',
        });
      } else {
        toast.info('El PDF se guardó en el dispositivo.');
      }
    } catch {
      toast.error('No se pudo exportar el resumen a PDF.');
    }
  };

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
          {data?.tituloNota || 'Resumen'}
        </Text>
        <Pressable
          onPress={exportarPdf}
          hitSlop={8}
          style={styles.iconBtn}
          disabled={!data}
          accessibilityLabel="Exportar a PDF"
        >
          <Ionicons
            name="share-outline"
            size={22}
            color={data ? tokens.accent : tokens.textMuted}
          />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Spinner size="lg" label="Cargando resumen..." />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            No se pudo cargar el resumen
          </Text>
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            {(error as ErrorApi).message}
          </Text>
          <Button title="Reintentar" onPress={() => refetch()} />
        </View>
      ) : !data?.resumen ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: tokens.accentTint }]}>
            <Ionicons name="sparkles-outline" size={34} color={tokens.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            Este apunte aún no tiene resumen
          </Text>
          <Button
            title="Generar resumen"
            onPress={() => router.replace('/(tabs)/resumenes/generar')}
            icon={<Ionicons name="sparkles" size={16} color={tokens.accentContrast} />}
          />
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: tokens.bgApp }]}>
              <ActivityIndicator size="large" color={tokens.accent} />
            </View>
          )}
        />
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
  webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
});
