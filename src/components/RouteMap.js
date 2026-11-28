// Mapa pequeño con el trazado de una ruta de Transitous: cada tramo dibujado (a pie punteado,
// transporte en azul), con la salida (verde), los transbordos (azul) y la llegada (rojo).
// Reutiliza el mapa de OpenStreetMap con Leaflet (sin claves) de la pestaña Mapa.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView from './MapView';
import { Muted } from './ui';
import { withEs } from '../translate';

// Convierte un itinerario guardado en lo que entiende el mapa
function buildPayload(plan, from, to) {
  const legs = [];
  const points = [];
  const list = plan && Array.isArray(plan.legs) ? plan.legs : [];
  list.forEach((l, i) => {
    let pts = [];
    if (Array.isArray(l.geo) && l.geo.length >= 4) for (let k = 0; k + 1 < l.geo.length; k += 2) pts.push([l.geo[k], l.geo[k + 1]]);
    else if (Number.isFinite(l.fromLat) && Number.isFinite(l.toLat)) pts = [[l.fromLat, l.fromLon], [l.toLat, l.toLon]]; // sin trazado: línea recta
    if (pts.length > 1) legs.push({ mode: l.mode, pts });
    if (i > 0 && Number.isFinite(l.fromLat)) points.push({ lat: l.fromLat, lng: l.fromLon, name: withEs(l.from), kind: 'stop' });
  });
  const first = list[0], last = list[list.length - 1];
  const a = first && Number.isFinite(first.fromLat) ? { lat: first.fromLat, lng: first.fromLon, name: withEs(first.from) } : from ? { lat: from.lat, lng: from.lon, name: withEs(from.name) } : null;
  const b = last && Number.isFinite(last.toLat) ? { lat: last.toLat, lng: last.toLon, name: withEs(last.to) } : to ? { lat: to.lat, lng: to.lon, name: withEs(to.name) } : null;
  if (a) points.push({ ...a, kind: 'start' });
  if (b) points.push({ ...b, kind: 'end' });
  // Ruta antigua sin tramos con coordenadas: línea recta entre origen y destino
  if (!legs.length && a && b) legs.push({ mode: 'TRANSIT', pts: [[a.lat, a.lng], [b.lat, b.lng]] });
  return { type: 'route', legs, points };
}

export default function RouteMap({ plan, from, to, height = 220 }) {
  const map = useRef(null);
  const ready = useRef(false);
  const payload = useMemo(() => buildPayload(plan, from, to), [plan, from, to]);
  const latest = useRef(payload);
  latest.current = payload;

  const send = useCallback(() => { try { map.current && map.current.post(latest.current); } catch (e) { /* ignorar */ } }, []);
  // Cuando el mapa avisa de que está listo, se le manda la ruta
  const onMessage = useCallback((m) => { if (m && m.type === 'ready') { ready.current = true; send(); } }, [send]);
  // Si la ruta cambia con el mapa ya cargado, se vuelve a dibujar
  useEffect(() => { if (ready.current) send(); }, [payload, send]);

  if (!payload.legs.length && !payload.points.length) return null;
  return (
    <View style={{ marginVertical: 6 }}>
      <View style={{ height, borderRadius: 10, overflow: 'hidden' }}>
        <MapView ref={map} onMessage={onMessage} style={{ flex: 1, height }} />
      </View>
      <Muted>Trazado de la ruta · © OpenStreetMap contributors</Muted>
    </View>
  );
}
