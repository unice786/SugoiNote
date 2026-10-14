import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProveedorTema, useTema } from '@/context/TemaContext';
import { ProveedorSesion, useSesion } from '@/context/AuthContext';

/**
 * Layout raíz. Monta los proveedores de tema y sesión y decide si se muestra el
 * login o la aplicación. El bloqueo por aquí evita que alguien entre a una
 * pantalla protegida saltándose el login con un enlace directo.
 */
function Contenido() {
  const { colores, tema } = useTema();
  const { cargando, estudiante } = useSesion();

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colores.bgApp, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colores.accent} size="large" />
      </View>
    );
  }

  if (!estudiante) return <Redirect href="/login" />;

  return (
    <>
      <StatusBar style={tema === 'oscuro' ? 'light' : 'dark'} />

      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colores.bgSurface },
          headerTintColor: colores.textPrimary,
          contentStyle: { backgroundColor: colores.bgApp },
        }}
      >
        <Stack.Screen name="(pestanas)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="editor" options={{ title: 'Apunte' }} />
        <Stack.Screen name="resumen" options={{ title: 'Resumen' }} />
        <Stack.Screen name="examen" options={{ title: 'Examen' }} />
        <Stack.Screen name="post" options={{ title: 'Publicación' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProveedorTema>
        <ProveedorSesion>
          <Contenido />
        </ProveedorSesion>
      </ProveedorTema>
    </SafeAreaProvider>
  );
}