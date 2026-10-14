import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { ErrorApi, chat } from '../api/client';
import { useTema } from '../context/TemaContext';
import { htmlATexto } from '../utils/html';
import { Avatar, Burbuja, PantallaVacia } from '../components/chat';
import { estilosComunes } from '../components/ui';
import { espaciado, radius } from '../theme/tokens';

type Mensaje = { id: string; yo: boolean; texto: string };

export default function ChatScreen() {
  const { colores } = useTema();
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: 'saludo',
      yo: false,
      texto:
        'Hola 👋 Soy tu asistente de estudio. Pregúntame sobre tus apuntes, pídeme una explicación ' +
        'o que te ayude a preparar un examen.',
    },
  ]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<FlatList<Mensaje>>(null);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;

    setTexto('');
    setMensajes((m) => [...m, { id: String(Date.now()), yo: true, texto: t }]);
    setEnviando(true);

    try {
      const r = await chat.enviar(null, t);
      setMensajes((m) => [...m, { id: String(Date.now()) + 'b', yo: false, texto: htmlATexto(r.respuesta) }]);
    } catch (e) {
      const msg = e instanceof ErrorApi ? e.message : 'No se pudo contactar al asistente.';
      setMensajes((m) => [...m, { id: String(Date.now()) + 'e', yo: false, texto: `⚠️ ${msg}` }]);
    } finally {
      setEnviando(false);
      setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colores.bgApp }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listaRef}
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: espaciado.lg, gap: espaciado.md, flexGrow: 1 }}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<PantallaVacia />}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', justifyContent: item.yo ? 'flex-end' : 'flex-start' }}>
            {!item.yo ? <Avatar /> : null}
            <Burbuja texto={item.texto} yo={item.yo} />
          </View>
        )}
      />

      {enviando ? (
        <View style={{ paddingHorizontal: espaciado.lg, paddingBottom: espaciado.sm }}>
          <Text style={{ color: colores.textMuted, fontSize: 12 }}>Escribiendo…</Text>
        </View>
      ) : null}

      <View
        style={[
          estilosComunes.fila,
          {
            padding: espaciado.md,
            borderTopWidth: 1,
            borderTopColor: colores.borderSubtle,
            backgroundColor: colores.bgSurface,
          },
        ]}
      >
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe tu pregunta…"
          placeholderTextColor={colores.textMuted}
          multiline
          style={{
            flex: 1,
            backgroundColor: colores.bgElevated,
            borderRadius: radius.lg,
            paddingHorizontal: 16,
            paddingVertical: 10,
            color: colores.textPrimary,
            fontSize: 15,
            maxHeight: 120,
          }}
        />
        <Pressable
          onPress={enviar}
          disabled={!texto.trim() || enviando}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: texto.trim() ? colores.accent : colores.bgElevated,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: texto.trim() ? '#fff' : colores.textMuted, fontSize: 18 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}