import React from 'react';
import { Text, View } from 'react-native';
import { useTema } from '../context/TemaContext';
import { espaciado, radius } from '../theme/tokens';

export function Avatar({ nombre }: { nombre?: string }) {
  const { colores } = useTema();
  const inicial = (nombre ?? 'IA').trim().charAt(0).toUpperCase();

  return (
    <View
      style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colores.accent,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{inicial}</Text>
    </View>
  );
}

export function Burbuja({ texto, yo }: { texto: string; yo: boolean }) {
  const { colores } = useTema();

  return (
    <View
      style={{
        backgroundColor: yo ? colores.accent : colores.bgSurface,
        borderWidth: yo ? 0 : 1,
        borderColor: colores.borderSubtle,
        borderRadius: radius.lg,
        borderBottomRightRadius: yo ? 4 : radius.lg,
        borderBottomLeftRadius: yo ? radius.lg : 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxWidth: '82%',
      }}
    >
      <Text style={{ color: yo ? '#fff' : colores.textPrimary, fontSize: 15, lineHeight: 21 }}>{texto}</Text>
    </View>
  );
}

export function PantallaVacia() {
  const { colores } = useTema();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaciado.xxl }}>
      <Text style={{ fontSize: 34 }}>💬</Text>
      <Text style={{ color: colores.textMuted, marginTop: espaciado.sm }}>Sin mensajes todavía.</Text>
    </View>
  );
}