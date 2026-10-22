import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Input, Button } from '../../components/ui';
import { auth, ErrorApi } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const { tokens } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return Alert.alert('Faltan datos', 'Completa todos los campos.');
    setBusy(true);
    try {
      const res = await auth.login(email, password);
      // Se espera a guardar el token ANTES de navegar. Si no, las peticiones de
      // las pestañas salian sin Authorization y devolvian 401.
      await login(res.estudiante, res.token);
      router.replace('/(tabs)');
    } catch (e) {
      const err = e as ErrorApi;
      Alert.alert('No se pudo iniciar', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: tokens.bgApp }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: tokens.accent }]}>
            <Text style={styles.logoText}>✦</Text>
          </View>
          <Text style={[styles.brandText, { color: tokens.textInverse }]}>SugoiNote</Text>
        </View>

        <Text style={[styles.loginTitle, { color: tokens.textInverse }]}>Bienvenido de vuelta</Text>
        <Text style={[styles.loginSub, { color: '#aaa2bd' }]}>Ingresa tus datos para continuar</Text>

        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="Correo electrónico"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          secureTextEntry={true}
          passwordToggle={true}
          autoComplete="password"
        />

        <Button
          title="Iniciar sesión"
          onPress={handleSubmit}
          fullWidth={true}
          size="lg"
          loading={busy}
        />

        <Pressable onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.link}>¿No tienes cuenta? Regístrate aquí</Text>
        </Pressable>

        <View style={styles.features}>
          <Text style={styles.feature}>✦ Resúmenes con IA</Text>
          <Text style={styles.feature}>▤ Organiza tus apuntes</Text>
          <Text style={styles.feature}>✓ Exámenes personalizados</Text>
          <Text style={styles.feature}>● Chat de estudio</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 32, paddingBottom: 32, flexGrow: 1, justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 28 },
  logo: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 21 },
  brandText: { fontSize: 22, fontWeight: '800' },
  loginTitle: { fontSize: 26, fontWeight: '800', marginBottom: 7 },
  loginSub: { fontSize: 15, marginBottom: 22 },
  link: { color: '#bda8ff', textAlign: 'center', fontSize: 14, fontWeight: '600', marginTop: 18 },
  features: { borderTopColor: '#342b42', borderTopWidth: 1, marginTop: 30, paddingTop: 17, gap: 10 },
  feature: { color: '#aaa2bd', fontSize: 14 },
});