import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const light = { primary: '#1E6FD9', bg: '#F3F6FA', card: '#FFFFFF', text: '#1B2430', muted: '#6B7785', danger: '#D64545', ok: '#2E9E5B', border: '#DDE3EA', input: '#FFFFFF', placeholder: '#9AA5B1', warn: '#FFF6E0', onPrimary: '#FFFFFF' };
const dark = { primary: '#4C9AFF', bg: '#10151C', card: '#1B232E', text: '#E8EDF3', muted: '#9AA7B5', danger: '#F06A6A', ok: '#4CC585', border: '#2D3948', input: '#141B24', placeholder: '#6B7785', warn: '#3A3320', onPrimary: '#0B1118' };

const Ctx = createContext({ mode: 'light', colors: light, toggle: () => {} });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    AsyncStorage.getItem('themeMode').then((m) => { if (m === 'dark' || m === 'light') setMode(m); }).catch(() => {});
  }, []);
  const value = useMemo(() => ({
    mode,
    colors: mode === 'dark' ? dark : light,
    toggle: () => setMode((m) => {
      const n = m === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem('themeMode', n).catch(() => {});
      return n;
    }),
  }), [mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
