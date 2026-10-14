import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Colores, Tema, temas } from '../theme/tokens';

export type Preferencia = 'claro' | 'oscuro' | 'auto';

type CtxTema = {
  tema: Tema;
  preferencia: Preferencia;
  colores: Colores;
  setPreferencia: (p: Preferencia) => void;
  alternar: () => void;
};

const TemaCtx = createContext<CtxTema | null>(null);

export function ProveedorTema({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme();
  const [preferencia, setPref] = useState<Preferencia>('auto');

  const tema: Tema = preferencia === 'auto' ? (sistema === 'dark' ? 'oscuro' : 'claro') : preferencia;

  useEffect(() => {
    // El tema determina el color de la barra de navegación de Android.
    // NavigationBar se ajusta desde App.tsx.
  }, [tema]);

  const valor = useMemo<CtxTema>(
    () => ({
      tema,
      preferencia,
      colores: temas[tema],
      setPreferencia: setPref,
      alternar: () => setPref(tema === 'oscuro' ? 'claro' : 'oscuro'),
    }),
    [tema, preferencia],
  );

  return <TemaCtx.Provider value={valor}>{children}</TemaCtx.Provider>;
}

export function useTema(): CtxTema {
  const ctx = useContext(TemaCtx);
  if (!ctx) throw new Error('useTema debe usarse dentro de <ProveedorTema>.');
  return ctx;
}