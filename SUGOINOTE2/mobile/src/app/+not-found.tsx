import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/ui';

export default function NotFoundScreen() {
  const { tokens } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <View style={[styles.container, { backgroundColor: tokens.bgApp }]}>
        <Text style={[styles.code, { color: tokens.accent }]}>404</Text>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>Pantalla no encontrada</Text>
        <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
          La ruta a la que intentaste acceder no existe.
        </Text>
        <Button title="Volver al inicio" onPress={() => router.replace('/')} style={styles.button} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  code: { fontSize: 64, fontWeight: '800', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  button: { alignSelf: 'stretch' },
});
