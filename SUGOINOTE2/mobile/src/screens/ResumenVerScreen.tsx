import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorApi, resumenes } from '../api/client';
import { useTema } from '../context/TemaContext';
import { htmlATexto } from '../utils/html';
import { Aviso, Cargando, Pantalla } from '../components/ui';
import { espaciado } from '../theme/tokens';

/**
 * Muestra el resumen de un apunte.
 *
 * Se pide por `apunteId` en vez de pasar el HTML por la ruta: meter el HTML en
 * los query params lo trunca y lo hace ilegible. Se convierte a texto plano
 * porque en móvil no hay un visor de HTML, y así tampoco se depende de una WebView
 * que abriría la puerta a inyección si el HTML viniera manipulado.
 */
export default function ResumenVerScreen({ route }: any) {
  const { colores } = useTema();
  const apunteId: string = route.params?.apunteId ?? '';
  const tituloParam: string = route.params?.titulo ?? '';

  const [titulo, setTitulo] = useState(tituloParam);
  const [html, setHtml] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        setError(null);
        const r = await resumenes.obtener(apunteId);
        if (!vivo) return;
        setHtml(r.resumen);
        if (!tituloParam) setTitulo(r.tituloNota);
      } catch (e) {
        if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el resumen.');
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [apunteId, tituloParam]);

  if (cargando) return <Pantalla><Cargando texto="Cargando resumen…" /></Pantalla>;

  if (error || !html) {
    return (
      <Pantalla>
        <Aviso texto={error ?? 'Este apunte todavía no tiene un resumen generado.'} />
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <View style={{ marginBottom: espaciado.lg }}>
        <Text style={{ color: colores.textPrimary, fontSize: 22, fontWeight: '800' }}>{titulo}</Text>
        <Text style={{ color: colores.accent, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
          Generado con IA
        </Text>
      </View>

      <Text style={{ color: colores.textSecondary, fontSize: 16, lineHeight: 26 }}>
        {htmlATexto(html)}
      </Text>
    </Pantalla>
  );
}