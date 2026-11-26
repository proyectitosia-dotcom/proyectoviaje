// Pestaña "Mapa": mapa OpenStreetMap (Leaflet), ubicación en vivo, buscador y "Cómo llegar".
// Sin APIs de pago ni claves: la búsqueda y las rutas se delegan a Google Maps / Waze por enlace.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Linking, Modal, Platform, TouchableOpacity, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Btn, Field, Text, Card, useTheme, useStyles, notify } from '../components/ui';
import MapView from '../components/MapView';

// ---- Enlaces externos (se abren con Linking: la app si está instalada, si no el navegador) ----
export const googleSearchUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const wazeSearchUrl = (q) => `https://waze.com/ul?q=${encodeURIComponent(q)}`;
export const googleDirUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
export const wazeDirUrl = (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

const openUrl = (url) => Linking.openURL(url).catch(() => notify('No se pudo abrir el enlace'));

export default function MapScreen() {
  const { colors } = useTheme();
  const st = useStyles(makeStyles);
  const map = useRef(null);
  const ready = useRef(false);
  const pending = useRef([]);       // mensajes para el mapa enviados antes de que esté listo
  const lastPos = useRef(null);     // última posición conocida del usuario
  const [query, setQuery] = useState('');
  const [dest, setDest] = useState(null);       // punto tocado en el mapa {lat, lng}
  const [chooser, setChooser] = useState(false); // selector Google Maps / Waze
  const [locError, setLocError] = useState(null); // aviso si no hay ubicación

  // Enviar al mapa (o dejar en cola si aún no ha cargado)
  const post = useCallback((m) => {
    if (ready.current && map.current) map.current.post(m);
    else pending.current.push(m);
  }, []);

  const onMapMessage = useCallback((m) => {
    if (m.type === 'ready') {
      ready.current = true;
      pending.current.forEach((x) => map.current && map.current.post(x));
      pending.current = [];
    } else if (m.type === 'tap') setDest({ lat: m.lat, lng: m.lng });
  }, []);

  // ---- Ubicación en tiempo real ----
  const sub = useRef(null);
  const startLocation = useCallback(async () => {
    setLocError(null);
    try {
      if (sub.current) { sub.current.remove(); sub.current = null; }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocError('Sin permiso de ubicación. Actívalo para ver tu posición en el mapa.');
        return;
      }
      let first = true;
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 3000 },
        (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
          lastPos.current = pos;
          post({ type: 'user', ...pos, accuracy: p.coords.accuracy });
          if (first) { first = false; post({ type: 'center', ...pos, zoom: 15 }); } // centrar solo la primera vez
        },
        () => setLocError('No se pudo obtener tu ubicación. Revisa que el GPS esté activado.')
      );
    } catch {
      setLocError('No se pudo obtener tu ubicación. Revisa que el GPS esté activado.');
    }
  }, [post]);

  useEffect(() => {
    startLocation();
    return () => { if (sub.current) sub.current.remove(); };
  }, [startLocation]);

  const goMe = () => {
    if (lastPos.current) post({ type: 'center', ...lastPos.current, zoom: 16 });
    else startLocation(); // aún sin posición: reintentar (y volver a pedir permiso)
  };

  // ---- Buscador ----
  const search = (open) => {
    const q = query.trim();
    if (!q) return; // texto vacío: no abrir nada
    openUrl(open(q));
  };

  const route = (url) => { setChooser(false); openUrl(url); };

  return (
    <View style={{ flex: 1 }}>
      <View style={st.top}>
        <Field value={query} onChangeText={setQuery} placeholder="Buscar lugar o dirección" returnKeyType="search" onSubmitEditing={() => search(googleSearchUrl)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn style={{ flex: 1 }} small title="🔎 Buscar" onPress={() => search(googleSearchUrl)} />
          <Btn style={{ flex: 1 }} small kind="outline" title="Buscar en Waze" onPress={() => search(wazeSearchUrl)} />
        </View>
        {locError ? (
          <View style={st.warn}>
            <Text style={{ fontSize: 13 }}>{locError}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Platform.OS !== 'web' && <Btn small kind="outline" title="Abrir Ajustes" onPress={() => Linking.openSettings().catch(() => {})} />}
              <Btn small kind="outline" title="Reintentar" onPress={startLocation} />
            </View>
            {Platform.OS === 'web' && <Text style={{ fontSize: 12, color: colors.muted }}>En el navegador, permite la ubicación con el candado junto a la dirección.</Text>}
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <MapView ref={map} onMessage={onMapMessage} style={{ flex: 1 }} />
        <View style={st.fabs} pointerEvents="box-none">
          <Btn small title="📍 Mi ubicación" onPress={goMe} />
          {dest && <Btn small kind="ok" title="🧭 Cómo llegar" onPress={() => setChooser(true)} />}
        </View>
      </View>

      {/* Selector propio (Alert.alert no funciona en web) */}
      <Modal visible={chooser} transparent animationType="fade" onRequestClose={() => setChooser(false)}>
        <TouchableOpacity activeOpacity={1} style={st.overlay} onPress={() => setChooser(false)}>
          <TouchableOpacity activeOpacity={1}>
            <Card>
              <Text style={st.title}>Cómo llegar con…</Text>
              <Btn title="Google Maps" onPress={() => dest && route(googleDirUrl(dest.lat, dest.lng))} />
              <Btn title="Waze" kind="outline" onPress={() => dest && route(wazeDirUrl(dest.lat, dest.lng))} />
              <Btn title="Cancelar" kind="outline" small onPress={() => setChooser(false)} />
            </Card>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => ({
  top: { padding: 10, paddingBottom: 4, backgroundColor: c.bg },
  warn: { backgroundColor: c.warn, borderRadius: 8, padding: 8, marginTop: 6 },
  fabs: { position: 'absolute', right: 10, bottom: 24, alignItems: 'flex-end' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
});
