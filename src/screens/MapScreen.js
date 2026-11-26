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

// Abre un enlace externo sin que un fallo (sin app, sin navegador, URL inválida) cierre la app
const openUrl = async (url) => {
  try { await Linking.openURL(url); } catch (e) { notify('No se pudo abrir el enlace'); }
};

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
  const mounted = useRef(true);      // evita actuar sobre la pantalla ya cerrada (callbacks tardíos de la ubicación)
  const post = useCallback((m) => {
    try {
      if (ready.current && map.current) map.current.post(m);
      else pending.current.push(m);
    } catch (e) { /* un fallo al hablar con el mapa no debe cerrar la app */ }
  }, []);

  const onMapMessage = useCallback((m) => {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'ready') {
      ready.current = true;
      const queued = pending.current; pending.current = [];
      queued.forEach((x) => { try { map.current && map.current.post(x); } catch (e) { /* ignorar */ } });
    } else if (m.type === 'tap' && Number.isFinite(m.lat) && Number.isFinite(m.lng)) setDest({ lat: m.lat, lng: m.lng });
  }, []);

  // ---- Ubicación en tiempo real ----
  const sub = useRef(null);
  const stopWatching = () => { try { if (sub.current) sub.current.remove(); } catch (e) { /* ignorar */ } sub.current = null; };
  const startLocation = useCallback(async () => {
    setLocError(null);
    const fail = (msg) => { if (mounted.current) setLocError(msg); };
    try {
      stopWatching();
      // En el navegador sin geolocalización (p. ej. página sin HTTPS) no se puede seguir
      if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && navigator.geolocation)) {
        return fail('Este navegador no permite usar la ubicación (necesita HTTPS o localhost).');
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        return fail('Sin permiso de ubicación. Actívalo para ver tu posición en el mapa.');
      }
      // GPS apagado en el móvil: avisar en lugar de fallar
      if (Platform.OS !== 'web' && Location.hasServicesEnabledAsync && !(await Location.hasServicesEnabledAsync())) {
        return fail('Tienes la ubicación (GPS) desactivada en el móvil. Actívala y pulsa Reintentar.');
      }
      let first = true;
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 3000 },
        (p) => {
          try {
            if (!mounted.current || !p || !p.coords) return;
            const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
            lastPos.current = pos;
            post({ type: 'user', ...pos, accuracy: p.coords.accuracy });
            if (first) { first = false; post({ type: 'center', ...pos, zoom: 15 }); } // centrar solo la primera vez
          } catch (e) { /* ignorar una lectura rara */ }
        },
        () => fail('No se pudo obtener tu ubicación. Revisa que el GPS esté activado.')
      );
      // Si la pantalla se cerró mientras se pedía la ubicación, se cancela la suscripción
      if (!mounted.current) { try { subscription.remove(); } catch (e) { /* ignorar */ } return; }
      sub.current = subscription;
    } catch (e) {
      fail('No se pudo obtener tu ubicación. Revisa que el GPS esté activado.');
    }
  }, [post]);

  useEffect(() => {
    mounted.current = true;
    startLocation();
    return () => { mounted.current = false; stopWatching(); };
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
