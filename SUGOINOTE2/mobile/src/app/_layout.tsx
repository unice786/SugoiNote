import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../components/ui/Toast';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="auto" />
              <RootStack />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Guardia de sesion: sin usuario no se puede entrar a las pestanas, y con
  // usuario no tiene sentido quedarse en las pantallas de autenticacion.
  // Antes no existia: una instalacion nueva abria directamente las pestanas sin
  // token y todas las secciones respondian "Error 401".
  useEffect(() => {
    if (loading) return;
    const enAuth = segments[0] === '(auth)';
    if (!user && !enAuth) {
      router.replace('/(auth)/login');
    } else if (user && enAuth) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  // Mientras se comprueba la sesion guardada no mostramos ninguna pantalla:
  // evita el parpadeo entre login y pestanas al abrir la app.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" options={{ presentation: 'modal' }} />
    </Stack>
  );
}