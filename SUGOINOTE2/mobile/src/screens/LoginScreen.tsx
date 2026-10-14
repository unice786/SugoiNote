import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../context/TemaContext';
import { useSesion } from '../context/AuthContext';
import { API_BASE, ErrorApi } from '../api/client';
import { Aviso, Boton, Campo, Pantalla, estilosComunes } from '../components/ui';
import { espaciado, radius } from '../theme/tokens';

type Modo = 'login' | 'registro';

export default function LoginScreen() {
  const { colores } = useTema();
  const { iniciarSesion, registrarse } = useSesion();
  const insets = useSafeAreaInsets();

  const [modo, setModo] = useState<Modo>('login');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);

    if (!correo.trim()) return setError('Escribe tu correo electrónico.');
    if (!clave) return setError('Escribe tu contraseña.');
    if (modo === 'registro' && nombre.trim().length < 2)
      return setError('Escribe tu nombre completo.');
    if (modo === 'registro' && clave.length < 8)
      return setError('La contraseña debe tener al menos 8 caracteres.');

    setEnviando(true);
    try {
      if (modo === 'login') await iniciarSesion(correo.trim(), clave);
      else await registrarse(nombre.trim(), correo.trim(), clave);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo completar la operación.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pantalla>
        <View style={{ height: insets.top }} />

        <View style={{ alignItems: 'center', marginBottom: espaciado.xxl, marginTop: espaciado.xl }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: colores.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: espaciado.md,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>S</Text>
          </View>
          <Text style={{ color: colores.textPrimary, fontSize: 28, fontWeight: '800' }}>SugoiNote</Text>
          <Text style={{ color: colores.textMuted, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
            Apuntes, resúmenes y exámenes{'\n'}potenciados con IA
          </Text>
        </View>

        <Aviso texto={error} onCerrar={() => setError(null)} />

        {modo === 'registro' ? (
          <Campo
            etiqueta="Nombre completo"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Marvin Antonio"
            autoCapitalize="words"
            returnKeyType="next"
          />
        ) : null}

        <Campo
          etiqueta="Correo electrónico"
          value={correo}
          onChangeText={setCorreo}
          placeholder="estudiante@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        <Campo
          etiqueta="Contraseña"
          value={clave}
          onChangeText={setClave}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={enviar}
        />

        <Boton titulo={modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} onPress={enviar} cargando={enviando} ancho />

        <Pressable
          onPress={() => {
            setModo(modo === 'login' ? 'registro' : 'login');
            setError(null);
          }}
          style={{ alignSelf: 'center', marginTop: espaciado.lg, padding: 8 }}
        >
          <Text style={{ color: colores.accent, fontWeight: '600', fontSize: 14 }}>
            {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </Pressable>

        <View style={[estilosComunes.columna, { marginTop: espaciado.xxl, padding: espaciado.md, borderRadius: radius.md, backgroundColor: colores.bgElevated }]}>
          <Text style={{ color: colores.textSecondary, fontWeight: '700', fontSize: 12 }}>API conectada</Text>
          <Text style={{ color: colores.textMuted, fontSize: 11 }} selectable>
            {API_BASE}
          </Text>
          <Text style={{ color: colores.textMuted, fontSize: 11 }}>
            Cambia este valor en mobile/src/api/client.ts si la API está en otro sitio.
          </Text>
        </View>
      </Pantalla>
    </KeyboardAvoidingView>
  );
}