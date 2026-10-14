import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, espaciado } from '../theme/tokens';
import { useTema } from '../context/TemaContext';

// ── Pantalla ──────────────────────────────────────────────────

export function Pantalla({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();

  const contenido: ViewStyle = {
    flex: 1,
    backgroundColor: colores.bgApp,
    paddingBottom: insets.bottom + espaciado.xl,
  };

  if (!scroll) return <View style={[contenido, style]}>{children}</View>;

  return (
    <ScrollView
      style={contenido}
      contentContainerStyle={{ padding: espaciado.lg, paddingTop: espaciado.sm }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// ── Encabezado de pantalla ────────────────────────────────────

export function Encabezado({ titulo, subtitulo, derecha }: {
  titulo: string;
  subtitulo?: string;
  derecha?: React.ReactNode;
}) {
  const { colores } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: espaciado.lg, gap: espaciado.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colores.textPrimary, fontSize: 26, fontWeight: '800' }}>{titulo}</Text>
        {subtitulo ? (
          <Text style={{ color: colores.textMuted, fontSize: 13, marginTop: 2 }}>{subtitulo}</Text>
        ) : null}
      </View>
      {derecha}
    </View>
  );
}

// ── Tarjeta ───────────────────────────────────────────────────

export function Tarjeta({ children, style, onPress }: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colores } = useTema();
  const base: ViewStyle = {
    backgroundColor: colores.bgSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colores.borderSubtle,
    padding: espaciado.lg,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { backgroundColor: colores.bgSurfaceHover }, style]}
    >
      {children}
    </Pressable>
  );
}

// ── Botones ───────────────────────────────────────────────────

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  deshabilitado,
  cargando,
  ancho,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  deshabilitado?: boolean;
  cargando?: boolean;
  ancho?: boolean;
}) {
  const { colores } = useTema();

  const fondos: Record<string, string> = {
    primario: colores.accent,
    secundario: colores.bgElevated,
    peligro: colores.danger,
    fantasma: 'transparent',
  };

  const textos: Record<string, string> = {
    primario: colores.accentContrast,
    secundario: colores.textPrimary,
    peligro: '#ffffff',
    fantasma: colores.textMuted,
  };

  return (
    <Pressable
      onPress={deshabilitado || cargando ? undefined : onPress}
      disabled={deshabilitado || cargando}
      style={({ pressed }) => ({
        backgroundColor: fondos[variante],
        borderRadius: radius.sm,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: deshabilitado ? 0.5 : pressed ? 0.8 : 1,
        borderWidth: variante === 'fantasma' ? 1 : 0,
        borderColor: colores.borderDefault,
        alignSelf: ancho ? 'stretch' : 'auto',
        flexDirection: 'row',
        gap: 8,
      })}
    >
      {cargando ? <ActivityIndicator size="small" color={textos[variante]} /> : null}
      <Text style={{ color: textos[variante], fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
    </Pressable>
  );
}

// ── Campo de texto ────────────────────────────────────────────

export function Campo({
  etiqueta,
  error,
  ...props
}: TextInputProps & { etiqueta?: string; error?: string | null }) {
  const { colores } = useTema();

  return (
    <View style={{ marginBottom: espaciado.lg }}>
      {etiqueta ? (
        <Text style={{ color: colores.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
          {etiqueta}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colores.textMuted}
        {...props}
        style={[
          {
            backgroundColor: colores.bgSurface,
            borderWidth: 1,
            borderColor: error ? colores.danger : colores.borderDefault,
            color: colores.textPrimary,
            borderRadius: radius.sm,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
          },
          props.multiline && { minHeight: 96, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {error ? <Text style={{ color: colores.danger, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

// ── Estados ───────────────────────────────────────────────────

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  const { colores } = useTema();
  return (
    <View style={{ padding: espaciado.xxl, alignItems: 'center', gap: espaciado.md }}>
      <ActivityIndicator color={colores.accent} />
      <Text style={{ color: colores.textMuted, fontSize: 13 }}>{texto}</Text>
    </View>
  );
}

export function Vacio({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  const { colores } = useTema();
  return (
    <View style={{ alignItems: 'center', padding: espaciado.xxl, gap: espaciado.sm }}>
      <View
        style={{
          width: 72, height: 72, borderRadius: 22,
          backgroundColor: colores.bgElevated,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 30 }}>📝</Text>
      </View>
      <Text style={{ color: colores.textPrimary, fontSize: 16, fontWeight: '700', marginTop: espaciado.sm }}>
        {titulo}
      </Text>
      <Text style={{ color: colores.textMuted, fontSize: 13, textAlign: 'center' }}>{mensaje}</Text>
    </View>
  );
}

// ── Insignia ──────────────────────────────────────────────────

export function Insignia({ texto, tono = 'acento' }: { texto: string; tono?: 'acento' | 'exito' | 'peligro' | 'neutro' }) {
  const { colores } = useTema();
  const mapa = {
    acento: { bg: `${colores.accent}22`, fg: colores.accent },
    exito: { bg: `${colores.success}22`, fg: colores.success },
    peligro: { bg: `${colores.danger}22`, fg: colores.danger },
    neutro: { bg: colores.bgElevated, fg: colores.textMuted },
  } as const;

  const t = mapa[tono];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: t.fg, fontSize: 11, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

// ── Aviso de error ────────────────────────────────────────────

export function Aviso({ texto, onCerrar }: { texto: string | null; onCerrar?: () => void }) {
  const { colores } = useTema();
  if (!texto) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: `${colores.danger}18`,
        borderColor: `${colores.danger}55`,
        borderWidth: 1,
        borderRadius: radius.sm,
        padding: 12,
        marginBottom: espaciado.lg,
      }}
    >
      <Text style={{ color: colores.danger, fontSize: 16 }}>⚠️</Text>
      <Text style={{ color: colores.danger, fontSize: 13, flex: 1 }}>{texto}</Text>
      {onCerrar ? (
        <Pressable onPress={onCerrar} hitSlop={8}>
          <Text style={{ color: colores.danger, fontSize: 18, lineHeight: 18 }}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const estilosComunes = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  columna: { gap: 8 },
});

// ── Modal ─────────────────────────────────────────────────────

export function ModalSimple({
  visible,
  titulo,
  onCerrar,
  children,
}: {
  visible: boolean;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const { colores } = useTema();
  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onCerrar} />

      <View
        style={{
          backgroundColor: colores.bgSurface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: espaciado.lg,
          paddingBottom: espaciado.xxl,
          maxHeight: '90%',
        }}
      >
        <View style={estilosComunes.fila}>
          <Text style={{ color: colores.textPrimary, fontSize: 18, fontWeight: '800', flex: 1 }}>{titulo}</Text>
          <Pressable onPress={onCerrar} hitSlop={10}>
            <Text style={{ color: colores.textMuted, fontSize: 26, lineHeight: 28 }}>×</Text>
          </Pressable>
        </View>

        <View style={{ height: espaciado.lg }} />
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </View>
  );
}