import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useToast } from '../../components/ui';
import { chat, ErrorApi } from '../../api/client';

interface Mensaje {
  id: number;
  texto: string;
  esUsuario: boolean;
  error?: boolean;
}

function Burbuja({ texto, esUsuario, error }: Mensaje) {
  const { tokens } = useTheme();

  if (esUsuario) {
    return (
      <View style={styles.rowUser}>
        <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: tokens.accent }]}>
          <Text style={[styles.bubbleText, { color: tokens.accentContrast }]}>{texto}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rowIa}>
      <View style={[styles.avatar, { backgroundColor: tokens.onSurface06 }]}>
        <Ionicons name="sparkles" size={15} color={tokens.accent} />
      </View>
      <View
        style={[
          styles.bubble,
          styles.bubbleIa,
          { backgroundColor: tokens.bgSurface, borderColor: error ? tokens.danger : tokens.borderSubtle },
        ]}
      >
        <Text style={[styles.bubbleText, { color: error ? tokens.danger : tokens.textPrimary }]}>
          {texto}
        </Text>
      </View>
    </View>
  );
}

function Escribiendo() {
  const { tokens } = useTheme();
  return (
    <View style={styles.rowIa}>
      <View style={[styles.avatar, { backgroundColor: tokens.onSurface06 }]}>
        <Ionicons name="sparkles" size={15} color={tokens.accent} />
      </View>
      <View
        style={[
          styles.bubble,
          styles.bubbleIa,
          styles.bubbleTyping,
          { backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle },
        ]}
      >
        <ActivityIndicator size="small" color={tokens.accent} />
        <Text style={[styles.bubbleText, { color: tokens.textMuted }]}>Escribiendo…</Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { tokens } = useTheme();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(0);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: 0,
      texto: 'Soy tu asistente de estudio. Pregúntame lo que quieras sobre tus apuntes.',
      esUsuario: false,
    },
  ]);

  const nuevaId = () => ++idRef.current;
  const puedeEnviar = entrada.trim().length > 0 && !enviando;

  const enviar = async () => {
    const texto = entrada.trim();
    if (!texto || enviando) return;

    setMensajes((prev) => [...prev, { id: nuevaId(), texto, esUsuario: true }]);
    setEntrada('');
    setEnviando(true);

    try {
      const res = await chat.enviar(texto);
      setMensajes((prev) => [
        ...prev,
        { id: nuevaId(), texto: res.respuesta, esUsuario: false },
      ]);
    } catch (err) {
      const mensaje =
        (err as ErrorApi)?.message || 'Hubo un error al obtener respuesta. Intenta de nuevo.';
      setMensajes((prev) => [
        ...prev,
        { id: nuevaId(), texto: mensaje, esUsuario: false, error: true },
      ]);
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const limpiar = () => {
    setMensajes([
      { id: nuevaId(), texto: 'Chat reiniciado. ¿En qué puedo ayudarte?', esUsuario: false },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.bgApp }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { borderBottomColor: tokens.borderSubtle }]}>
        <View style={[styles.headerIcon, { backgroundColor: tokens.onSurface06 }]}>
          <Ionicons name="chatbubbles" size={22} color={tokens.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Chat IA</Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            Tu tutor académico personal
          </Text>
        </View>
        {mensajes.length > 1 ? (
          <Pressable
            onPress={limpiar}
            hitSlop={8}
            style={styles.clearBtn}
            accessibilityLabel="Limpiar chat"
          >
            <Ionicons name="trash-outline" size={20} color={tokens.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.mensajes}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {mensajes.map((m) => (
          <Burbuja key={m.id} id={m.id} texto={m.texto} esUsuario={m.esUsuario} error={m.error} />
        ))}
        {enviando ? <Escribiendo /> : null}
      </ScrollView>

      <View
        style={[
          styles.inputArea,
          { backgroundColor: tokens.bgSurface, borderTopColor: tokens.borderSubtle },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: tokens.textPrimary,
              backgroundColor: tokens.bgInset,
              borderColor: tokens.borderDefault,
            },
          ]}
          placeholder="Escribe tu pregunta..."
          placeholderTextColor={tokens.textMuted}
          value={entrada}
          onChangeText={setEntrada}
          multiline
          editable={!enviando}
        />
        <Pressable
          onPress={enviar}
          disabled={!puedeEnviar}
          style={[
            styles.sendBtn,
            { backgroundColor: puedeEnviar ? tokens.accent : tokens.bgElevated },
          ]}
          accessibilityLabel="Enviar mensaje"
        >
          {enviando ? (
            <ActivityIndicator size="small" color={tokens.accentContrast} />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color={puedeEnviar ? tokens.accentContrast : tokens.textMuted}
            />
          )}
        </Pressable>
      </View>

      <Text style={[styles.disclaimer, { color: tokens.textMuted }]}>
        La IA puede cometer errores. Verifica la información importante.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  clearBtn: { padding: 6 },
  mensajes: { padding: 16, gap: 10, flexGrow: 1 },
  rowUser: { alignItems: 'flex-end' },
  rowIa: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingRight: 40 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { maxWidth: '100%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: {
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 16,
  },
  bubbleIa: {
    flexShrink: 1,
    borderWidth: 1,
    borderTopLeftRadius: 4,
  },
  bubbleTyping: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
});
