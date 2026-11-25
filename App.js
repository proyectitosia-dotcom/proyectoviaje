import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Card, H, Field, Btn, Muted, colors, confirm, notify } from './src/components/ui';
import { createTrip, tripExists, subscribeTrip, updateTrip, getMyTrips, addMyTrip, removeMyTrip, isShared } from './src/store';
import RoutesScreen from './src/screens/RoutesScreen';
import HotelsScreen from './src/screens/HotelsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import GroupScreen from './src/screens/GroupScreen';

const TABS = [
  ['ruta', 'Ruta', '🗺️', RoutesScreen],
  ['hoteles', 'Hoteles', '🏨', HotelsScreen],
  ['calendario', 'Calendario', '📅', CalendarScreen],
  ['gastos', 'Gastos', '💶', ExpensesScreen],
  ['grupo', 'Grupo', '👥', GroupScreen],
];

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

function Home({ onOpen }) {
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
      <Text style={st.title}>✈️ Proyecto Viaje</Text>
      {!isShared && <Card style={{ backgroundColor: '#FFF6E0' }}><Muted>Modo local: configura Firebase en src/firebaseConfig.js para compartir viajes y sincronizar en tiempo real.</Muted></Card>}
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
        <H>Nuevo viaje</H>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Verano en Italia" />
        <Field label="Fecha de inicio" value={start} onChangeText={setStart} placeholder="AAAA-MM-DD" />
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
  const [trip, setTrip] = useState(undefined);
  const [tab, setTab] = useState('ruta');
  useEffect(() => subscribeTrip(code, (t) => { setTrip(t); if (t) addMyTrip(code, t.name); }), [code]);
  const update = (patch) => updateTrip(code, patch).catch((e) => notify('Error al guardar', String(e.message || e)));

  if (trip === undefined) return <ActivityIndicator style={{ marginTop: 60 }} size="large" />;
  if (trip === null) return <View style={{ padding: 20 }}><Text>Viaje no encontrado.</Text><Btn title="Volver" onPress={onExit} /></View>;
  const Screen = TABS.find((t) => t[0] === tab)[3];

  return (
    <View style={{ flex: 1 }}>
      <View style={st.header}>
        <Text style={st.back} onPress={onExit}>‹</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.hTitle} numberOfLines={1}>{trip.name}</Text>
          <Text style={st.hSub}>Código: {code}{isShared ? ' · en tiempo real' : ' · local'}</Text>
        </View>
        <Btn small title="Compartir" kind="outline" onPress={() => shareTrip(trip.name, code)} />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.bg }}><Screen trip={trip} update={update} code={code} /></View>
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

export default function App() {
  const [code, setCode] = useState(null);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          {code ? <Trip code={code} onExit={() => setCode(null)} /> : <Home onOpen={setCode} />}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border, gap: 8 },
  back: { fontSize: 32, color: colors.primary, paddingHorizontal: 6 },
  hTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  hSub: { fontSize: 12, color: colors.muted },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.border, paddingVertical: 6 },
  tab: { flex: 1, alignItems: 'center' },
});
