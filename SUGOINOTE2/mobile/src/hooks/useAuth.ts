import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Estudiante, guardarToken, borrarToken, leerToken, api } from '../api/client';

interface AuthContextType {
  user: Estudiante | null;
  loading: boolean;
  login: (estudiante: Estudiante, token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Estudiante | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api<{ estudianteId: string }>('/api/auth/me');
      if (data?.estudianteId) {
        const perfil = await api<Estudiante>('/api/perfil');
        setUser(perfil);
      } else {
        setUser(null);
        await borrarToken();
      }
    } catch {
      setUser(null);
      await borrarToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    leerToken().then((token) => {
      if (token) {
        refreshUser();
      } else {
        setLoading(false);
      }
    });
  }, [refreshUser]);

  const login = async (estudiante: Estudiante, token: string) => {
    await guardarToken(token);
    setUser(estudiante);
  };

  const logout = async () => {
    await borrarToken();
    setUser(null);
  };

  const value = { user, loading, login, logout, refreshUser };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}