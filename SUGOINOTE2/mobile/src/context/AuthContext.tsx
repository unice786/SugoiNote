import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EstudianteDto,
  alExpirarSesion,
  auth,
  borrarToken,
  guardarToken,
  leerToken,
} from '../api/client';

type CtxSesion = {
  cargando: boolean;
  estudiante: EstudianteDto | null;
  iniciarSesion: (correo: string, clave: string) => Promise<void>;
  registrarse: (nombre: string, correo: string, clave: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const SesionCtx = createContext<CtxSesion | null>(null);

const CLAVE_ESTUDIANTE = 'sugoinote_estudiante';

async function guardarEstudiante(e: EstudianteDto) {
  await AsyncStorage.setItem(CLAVE_ESTUDIANTE, JSON.stringify(e));
}

async function leerEstudianteGuardado(): Promise<EstudianteDto | null> {
  const raw = await AsyncStorage.getItem(CLAVE_ESTUDIANTE);
  return raw ? (JSON.parse(raw) as EstudianteDto) : null;
}

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [estudiante, setEstudiante] = useState<EstudianteDto | null>(null);

  // Al abrir la app se comprueba si el token guardado sigue siendo válido.
  useEffect(() => {
    let vivo = true;

    const MAX_ESPERA_MS = 8000;

    const tarea = (async () => {
      try {
        const token = await leerToken();
        if (!token) return;

        await auth.yo(); // 200 = el token sigue siendo válido
        const guardado = await leerEstudianteGuardado();
        if (vivo && guardado) setEstudiante(guardado);
      } catch {
        await borrarToken();
      }
    })();

    // Promise.race en vez de un finally dentro del async: si el almacenamiento o la
    // API se quedan colgados, la app no debe quedarse con el spinner para siempre.
    Promise.race([tarea, new Promise((r) => setTimeout(r, MAX_ESPERA_MS))]).finally(() => {
      if (vivo) setCargando(false);
    });

    return () => {
      vivo = false;
    };
  }, []);

  // Si la API responde 401 en cualquier pantalla, se cierra la sesión.
  useEffect(() => {
    alExpirarSesion(() => setEstudiante(null));
  }, []);

  const iniciarSesion = useCallback(async (correo: string, clave: string) => {
    const r = await auth.login(correo, clave);
    await guardarToken(r.token);
    await guardarEstudiante(r.estudiante);
    setEstudiante(r.estudiante);
  }, []);

  const registrarse = useCallback(async (nombre: string, correo: string, clave: string) => {
    const r = await auth.registrar(nombre, correo, clave);
    await guardarToken(r.token);
    await guardarEstudiante(r.estudiante);
    setEstudiante(r.estudiante);
  }, []);

  const cerrarSesion = useCallback(async () => {
    await borrarToken();
    await AsyncStorage.removeItem(CLAVE_ESTUDIANTE);
    setEstudiante(null);
  }, []);

  const valor = useMemo<CtxSesion>(
    () => ({ cargando, estudiante, iniciarSesion, registrarse, cerrarSesion }),
    [cargando, estudiante, iniciarSesion, registrarse, cerrarSesion],
  );

  return <SesionCtx.Provider value={valor}>{children}</SesionCtx.Provider>;
}

export function useSesion(): CtxSesion {
  const ctx = useContext(SesionCtx);
  if (!ctx) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>.');
  return ctx;
}