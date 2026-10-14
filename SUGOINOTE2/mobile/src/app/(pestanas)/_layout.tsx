import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useTema } from '@/context/TemaContext';

/**
 * Iconos con emoji a propósito: meter una fuente de iconos (react-native-vector-icons)
 * añade dependencias nativas y peso a la APK sin aportar nada aquí.
 */
const ICONOS: Record<string, string> = {
  inicio: '🏠',
  apuntes: '📓',
  resumenes: '✨',
  examenes: '📝',
  chat: '💬',
  comunidad: '👥',
  perfil: '👤',
};

export default function LayoutPestanas() {
  const { colores } = useTema();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.accent,
        tabBarInactiveTintColor: colores.textMuted,
        tabBarStyle: { backgroundColor: colores.bgSurface, borderTopColor: colores.borderSubtle },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }: { focused: boolean }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>•</Text>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{ICONOS.inicio}</Text>,
        }}
      />
      <Tabs.Screen
        name="apuntes"
        options={{
          title: 'Apuntes',
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{ICONOS.apuntes}</Text>,
        }}
      />
      <Tabs.Screen
        name="resumenes"
        options={{
          title: 'Resúmenes',
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{ICONOS.resumenes}</Text>,
        }}
      />
      <Tabs.Screen
        name="examenes"
        options={{
          title: 'Exámenes',
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{ICONOS.examenes}</Text>,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{ICONOS.chat}</Text>,
        }}
      />
      <Tabs.Screen
        name="comunidad"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{ICONOS.comunidad}</Text>,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{ICONOS.perfil}</Text>,
        }}
      />
    </Tabs>
  );
}