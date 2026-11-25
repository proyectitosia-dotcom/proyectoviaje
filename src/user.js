// Identidad de cada persona en este dispositivo: un id único + el nombre que elige.
// Sirve para saber quién añade cada gasto (no es una cuenta con contraseña).
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Ctx = createContext({ me: { id: '', name: '' }, ready: false, setName: () => {} });
export const useMe = () => useContext(Ctx);

const newId = () => `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function UserProvider({ children }) {
  const [me, setMe] = useState({ id: '', name: '' });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      let u = null;
      try { u = JSON.parse((await AsyncStorage.getItem('me')) || 'null'); } catch (e) { /* ignorar */ }
      if (!u || !u.id) u = { id: newId(), name: '' };
      try { await AsyncStorage.setItem('me', JSON.stringify(u)); } catch (e) { /* ignorar */ }
      setMe(u);
      setReady(true);
    })();
  }, []);
  const value = useMemo(() => ({
    me, ready,
    setName: (name) => setMe((cur) => {
      const u = { ...cur, name: String(name).trim() };
      AsyncStorage.setItem('me', JSON.stringify(u)).catch(() => {});
      return u;
    }),
  }), [me, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
