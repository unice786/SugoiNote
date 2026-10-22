import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ThemeTokens, lightTokens, darkTokens } from './tokens';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  tokens: ThemeTokens;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => Promise<void>;
  isDark: boolean;
}

const THEME_STORE_KEY = 'sugoinote.theme_preference';

const ThemeContext = createContext<ThemeContextType>({
  tokens: lightTokens,
  preference: 'system',
  setPreference: async () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []);

  const setPreference = async (pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      await SecureStore.setItemAsync(THEME_STORE_KEY, pref);
    } catch {
      // Ignore secure store write failure
    }
  };

  const isDark = useMemo(() => {
    if (preference === 'dark') return true;
    if (preference === 'light') return false;
    return systemScheme === 'dark';
  }, [preference, systemScheme]);

  const tokens = useMemo(() => {
    return isDark ? darkTokens : lightTokens;
  }, [isDark]);

  const value = useMemo(() => ({
    tokens,
    preference,
    setPreference,
    isDark,
  }), [tokens, preference, isDark]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
