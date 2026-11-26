import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Share, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Card, H, Field, Btn, Muted, Text, DateField, useStyles, confirm, notify } from './src/components/ui';
import { ThemeProvider, useTheme } from './src/theme';
import { UserProvider, useMe } from './src/user';
import { normalizeTrip } from './src/utils';
import { uid, createTrip, tripExists, subscribeTrip, updateTrip, getMyTrips, addMyTrip, removeMyTrip, isShared } from './src/store';
import RoutesScreen from './src/screens/RoutesScreen';
import HotelsScreen from './src/screens/HotelsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import GroupScreen from './src/screens/GroupScreen';
import MapScreen from './src/screens/MapScreen';
import ErrorBoundary, { GlobalErrorBanner, installGlobalErrorHandlers } from './src/components/ErrorBoundary';

// Captura errores fuera del dibujado (en móvil cerrarían la app) y los muestra como aviso
installGlobalErrorHandlers();

const TABS = [
  ['ruta', 'Ruta', '🗺️', RoutesScreen],
  ['mapa', 'Mapa', '📍', MapScreen],
  ['hoteles', 'Hoteles', '🏨', HotelsScreen],
  ['calendario', 'Calendario', '📅', CalendarScreen],
  ['gastos', 'Gastos', '💶', ExpensesScreen],
  ['grupo', 'Grupo', '👥', GroupScreen],
];

function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return <Btn small kind="outline" title={mode === 'dark' ? '☀️ Claro' : '🌙 Oscuro'} onPress={toggle} />;
}

async function shareTrip(name, code) {
  const message = `¡Únete a mi viaje "${name}" en Proyecto Viaje! Código: ${code}`;
  if (Platform.OS === 'web') {
    try {
      if (navigator.share) return await navigator.share({ text: message });
      await navigator.clipboard.writeText(message);
      return notify('Mensaje copiado al portapapeles', message);
    } catch { return notify('Código del viaje', code); }
  }
  Share.share({ message });
}

function NamePrompt() {
  const { setName } = useMe();
  const [v, setV] = useState('');
  return (
    <View style={{ padding: 16, paddingTop: 60 }}>
      <Card>
        <H>👋 ¿Cómo te llamas?</H>
        <Muted>Tu nombre aparecerá en los gastos que añadas y así los demás sabrán quién los ha puesto. Podrás cambiarlo cuando quieras.</Muted>
        <Field value={v} onChangeText={setV} placeholder="Tu nombre" onSubmitEditing={() => v.trim() && setName(v)} />
        <Btn title="Continuar" onPress={() => (v.trim() ? setName(v) : notify('Escribe tu nombre'))} />
      </Card>
    </View>
  );
}

function Home({ onOpen }) {
  const { me, setName: setMyName } = useMe();
  const [myName, setMyNameDraft] = useState(me.name);
  const { colors } = useTheme();
  const st = useStyles(makeStyles);
  const [trips, setTrips] = useState([]);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => { getMyTrips().then(setTrips); }, []);

  const create = async () => {
    if (!name.trim()) return notify('Pon un nombre al viaje');
    try {
      const c = await createTrip(name.trim(), start.trim());
      await addMyTrip(c, name.trim());
      onOpen(c);
    } catch (e) { notify('Error', String(e.message || e)); }
  };
  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (!(await tripExists(c))) return notify('No existe ningún viaje con ese código');
    onOpen(c);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={st.title}>✈️ Proyecto Viaje</Text>
        <ThemeToggle />
      </View>
      {!isShared && <Card style={{ backgroundColor: colors.warn }}><Muted>Modo local: configura Firebase en src/firebaseConfig.js para compartir viajes y sincronizar en tiempo real.</Muted></Card>}
      {trips.length > 0 && (
        <Card>
          <H>Mis viajes</H>
          {trips.map((t) => (
            <View key={t.code} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 8 }} onPress={() => onOpen(t.code)}>
                <Text style={{ fontSize: 16 }}>{t.name} <Text style={{ color: colors.muted }}>· {t.code}</Text></Text>
              </TouchableOpacity>
              <Text style={{ color: colors.danger, padding: 8 }} onPress={() => confirm('¿Quitar de la lista? (no se borra para los demás)', async () => { await removeMyTrip(t.code); setTrips(await getMyTrips()); })}>✕</Text>
            </View>
          ))}
        </Card>
      )}
      <Card>
        <H>👤 Mi nombre</H>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Field value={myName} onChangeText={setMyNameDraft} placeholder="Tu nombre" /></View>
          <Btn small title="Guardar" onPress={() => (myName.trim() ? (setMyName(myName), notify('Nombre guardado')) : notify('Escribe tu nombre'))} />
        </View>
      </Card>
      <Card>
        <H>Nuevo viaje</H>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Verano en Italia" />
        <DateField label="Fecha de inicio" value={start} onChange={setStart} />
        <Btn title="Crear viaje" onPress={create} />
      </Card>
      <Card>
        <H>Unirse a un viaje</H>
        <Field label="Código compartido" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABC123" />
        <Btn title="Unirse" kind="outline" onPress={join} />
      </Card>
    </ScrollView>
  );
}

function Trip({ code, onExit }) {
  const { colors } = useTheme();
  const st = useStyles(makeStyles);
  const [trip, setTrip] = useState(undefined);
  const [tab, setTab] = useState('ruta');
  useEffect(() => subscribeTrip(code, (t) => { setTrip(t); if (t) addMyTrip(code, t.name); }), [code]);
  const update = (patch) => updateTrip(code, patch).catch((e) => notify('Error al guardar', String(e.message || e)));

  // Al entrar en un viaje, la persona se añade sola a los miembros del grupo (una vez por entrada;
  // se repite a los pocos segundos por si dos personas entran a la vez y una pisa a la otra).
  const { me } = useMe();
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const joinTrip = () => {
    const t = tripRef.current;
    if (!t || !me.name) return;
    const group = { members: [], expenses: [], ...(t.group || {}) };
    const members = group.members || [];
    const mine = members.find((m) => m.userId === me.id);
    if (mine) {
      if (mine.name !== me.name) updateTrip(code, { group: { ...group, members: members.map((m) => (m.userId === me.id ? { ...m, name: me.name } : m)) } }).catch(() => {});
      return;
    }
    // Si ya existía un miembro con tu mismo nombre sin vincular, se reclama en vez de duplicarlo
    const same = members.find((m) => !m.userId && m.name.trim().toLowerCase() === me.name.trim().toLowerCase());
    const next = same ? members.map((m) => (m === same ? { ...m, userId: me.id } : m)) : [...members, { id: uid(), name: me.name, userId: me.id }];
    updateTrip(code, { group: { ...group, members: next } }).catch(() => {});
  };
  const joinedFor = useRef(null);
  useEffect(() => {
    if (!trip || joinedFor.current === code || !me.name) return undefined;
    joinedFor.current = code;
    joinTrip();
    const t = setTimeout(joinTrip, 3000);
    return () => clearTimeout(t);
  }, [trip === undefined || trip === null ? 0 : 1, code, me.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (trip === undefined) return <ActivityIndicator style={{ marginTop: 60 }} size="large" />;
  if (trip === null) return <View style={{ padding: 20 }}><Text>Viaje no encontrado.</Text><Btn title="Volver" onPress={onExit} /></View>;
  const Screen = (TABS.find((t) => t[0] === tab) || TABS[0])[3];
  const safeTrip = normalizeTrip(trip); // datos incompletos no deben romper las pantallas

  return (
    <View style={{ flex: 1 }}>
      <View style={st.header}>
        <Text style={st.back} onPress={onExit}>‹</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.hTitle} numberOfLines={1}>{trip.name}</Text>
          <Text style={st.hSub}>Código: {code}{isShared ? ' · en tiempo real' : ' · local'}</Text>
        </View>
        <ThemeToggle />
        <Btn small title="Compartir" kind="outline" onPress={() => shareTrip(trip.name, code)} />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ErrorBoundary key={tab} title="Esta pestaña ha fallado"><Screen trip={safeTrip} update={update} code={code} /></ErrorBoundary>
      </View>
      <View style={st.tabs}>
        {TABS.map(([k, label, icon]) => (
          <TouchableOpacity key={k} style={st.tab} onPress={() => setTab(k)}>
            <Text style={{ fontSize: 20 }}>{icon}</Text>
            <Text style={{ fontSize: 11, color: tab === k ? colors.primary : colors.muted, fontWeight: tab === k ? '700' : '400' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Root() {
  const { colors, mode } = useTheme();
  const [code, setCode] = useState(null);
  const { me, ready } = useMe();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }} edges={['top', 'bottom']}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <GlobalErrorBanner />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <ErrorBoundary title="La app ha tenido un problema">
          {!ready ? null : !me.name ? <NamePrompt /> : code ? <Trip code={code} onExit={() => setCode(null)} /> : <Home onOpen={setCode} />}
          </ErrorBoundary>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return <ThemeProvider><UserProvider><Root /></UserProvider></ThemeProvider>;
}

const makeStyles = (colors) => ({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border, gap: 8 },
  back: { fontSize: 32, color: colors.primary, paddingHorizontal: 6 },
  hTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  hSub: { fontSize: 12, color: colors.muted },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, paddingVertical: 6 },
  tab: { flex: 1, alignItems: 'center' },
});
