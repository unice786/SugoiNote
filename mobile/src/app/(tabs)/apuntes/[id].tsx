import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Modal, Spinner, useToast } from '../../../components/ui';
import { API_BASE, apuntes, leerToken, ErrorApi } from '../../../api/client';

export default function EditorApunteScreen() {
  const { tokens } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const webRef = useRef<WebView>(null);

  const [token, setToken] = useState<string | null>(null);
  const [tokenListo, setTokenListo] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  useEffect(() => {
    let vivo = true;
    leerToken().then((t) => {
      if (vivo) {
        setToken(t);
        setTokenListo(true);
      }
    });
    return () => {
      vivo = false;
    };
  }, []);

  const { data } = useQuery({
    queryKey: ['apunte', id],
    queryFn: () => apuntes.obtener(id),
    enabled: !!id,
  });

  const eliminar = useMutation({
    mutationFn: () => apuntes.eliminar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apuntes'] });
      queryClient.invalidateQueries({ queryKey: ['materias'] });
      setConfirmarEliminar(false);
      toast.success('Apunte eliminado');
      router.back();
    },
    onError: (err) => toast.error((err as ErrorApi).message),
  });

  const editorUrl = `${API_BASE}/Apuntes/Editor/${id}`;

  // El editor web guarda en /Apuntes/AutoSave con cookie + antifalsificador; el móvil
  // usa JWT. Aquí redirigimos ese guardado al endpoint de la API y añadimos el Bearer,
  // además de ocultar la barra de la web que duplica al encabezado nativo.
  const injected = useMemo(() => {
    if (!token) return 'true;';
    const api = JSON.stringify(API_BASE);
    const tok = JSON.stringify(token);
    const apunteId = JSON.stringify(id);
    return `
(function () {
  var API = ${api}, TOKEN = ${tok}, ID = ${apunteId};
  var origFetch = window.fetch;
  function conAuth(h) {
    var out = {};
    if (h) {
      if (typeof h.forEach === 'function' && typeof h.append === 'function') {
        h.forEach(function (v, k) { out[k] = v; });
      } else {
        for (var k in h) { if (Object.prototype.hasOwnProperty.call(h, k)) out[k] = h[k]; }
      }
    }
    out['Authorization'] = 'Bearer ' + TOKEN;
    return out;
  }
  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/Apuntes/AutoSave') !== -1) {
      try {
        var b = init.body ? JSON.parse(init.body) : {};
        init.body = JSON.stringify({ titulo: b.titulo, contenido: b.contenido });
      } catch (e) {}
      init.headers = conAuth(init.headers);
      return origFetch.call(this, API + '/api/apuntes/' + ID + '/autosave', init);
    }
    if (url.indexOf('/') === 0 || url.indexOf(API) === 0) {
      init.headers = conAuth(init.headers);
    }
    return origFetch.call(this, input, init);
  };
  var css = document.createElement('style');
  css.textContent = '.editor-header > a.btn-ghost{display:none !important}'
    + '.editor-menu-wrap{display:none !important}';
  (document.head || document.documentElement).appendChild(css);
})();
true;
`;
  }, [token, id]);

  const onShouldStartLoad = (req: { url: string }) => {
    const u = req.url;
    if (u === 'about:blank' || u.startsWith('blob:') || u.startsWith('data:')) return true;
    return u.startsWith(editorUrl);
  };

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
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
          {data?.tituloNota || 'Editor'}
        </Text>
        <Pressable
          onPress={() => setConfirmarEliminar(true)}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Eliminar apunte"
        >
          <Ionicons name="trash-outline" size={22} color={tokens.danger} />
        </Pressable>
      </View>

      {!tokenListo ? (
        <View style={styles.center}>
          <Spinner size="lg" label="Preparando editor..." />
        </View>
      ) : !token ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            Sesión expirada
          </Text>
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            Vuelve a iniciar sesión para editar este apunte.
          </Text>
          <Button title="Ir a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: editorUrl, headers: { Authorization: `Bearer ${token}` } }}
          injectedJavaScriptBeforeContentLoaded={injected}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: tokens.bgApp }]}>
              <ActivityIndicator size="large" color={tokens.accent} />
            </View>
          )}
          onError={() =>
            toast.error('No se pudo abrir el editor. Revisa la conexión con la API.')
          }
          style={{ backgroundColor: tokens.bgApp }}
        />
      )}

      <Modal
        visible={confirmarEliminar}
        onClose={() => setConfirmarEliminar(false)}
        title="Eliminar apunte"
        style={styles.modalBox}
      >
        <Text style={[styles.modalText, { color: tokens.textSecondary }]}>
          ¿Seguro que quieres eliminar «{data?.tituloNota ?? 'este apunte'}»? Esta acción no se
          puede deshacer.
        </Text>
        <View style={styles.modalActions}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setConfirmarEliminar(false)}
            style={styles.modalBtn}
          />
          <Button
            title="Eliminar"
            variant="danger"
            loading={eliminar.isPending}
            onPress={() => eliminar.mutate()}
            style={styles.modalBtn}
          />
        </View>
      </Modal>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalBox: { padding: 20 },
  modalText: { fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1 },
});
