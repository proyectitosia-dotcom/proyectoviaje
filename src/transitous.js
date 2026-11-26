// Cliente de Transitous (MOTIS 2): transporte público gratis y sin clave de API.
// Documentación y política de uso: https://transitous.org/api/
//
// Cómo se respeta la política de uso:
//  - Se identifica la app con un User-Agent propio (nombre, versión y contacto) en móvil.
//    En el navegador no se puede fijar ese encabezado; allí el navegador envía el Referer,
//    que Transitous admite como sustituto.
//  - Peticiones solo cuando el usuario pulsa "Buscar" / "Consultar" / "Actualizar" (nada de
//    buscar mientras se escribe ni de consultas automáticas).
//  - Caché: los lugares se guardan 7 días y las rutas 30 minutos. "Actualizar" salta la caché
//    pero no más de una vez por minuto por ruta.
//  - Tope diario de consultas de ruta en el dispositivo, muy por debajo del umbral de la política.
//  - Atribución: la pantalla de Rutas enlaza https://transitous.org/sources/ y menciona OpenStreetMap.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const API_BASE = 'https://api.transitous.org/api';
export const SOURCES_URL = 'https://transitous.org/sources/';
export const APP_NAME = 'ProyectoViaje';
export const APP_VERSION = '1.0';
// Transitous pide una forma de contacto (e-mail o web del proyecto) en el User-Agent.
// Ponla aquí, por ejemplo: 'https://github.com/tu-usuario/tu-repositorio'
export const CONTACT = '';

const GEO_TTL = 7 * 24 * 3600 * 1000;   // lugares: 7 días
const PLAN_TTL = 30 * 60 * 1000;        // rutas: 30 minutos
const DAILY_LIMIT = 300;                // consultas de ruta por día y dispositivo (la política habla de > 720/día)

// Error con un tipo para poder mostrar un mensaje claro: 'offline' | 'timeout' | 'http' | 'empty' | 'limit' | 'format'
export class TransitousError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

export const errorMessage = (e) => {
  switch (e && e.kind) {
    case 'offline': return 'No hay conexión a internet.';
    case 'timeout': return 'Transitous tarda demasiado en responder.';
    case 'http': return 'El servicio de Transitous no está disponible ahora mismo.';
    case 'empty': return 'Transitous no ha encontrado rutas de transporte público para esa fecha y hora.';
    case 'limit': return 'Has alcanzado el límite diario de consultas de rutas. Rellena los datos a mano o inténtalo mañana.';
    case 'format': return 'Transitous ha devuelto una respuesta inesperada.';
    default: return 'No se pudo consultar Transitous.';
  }
};

const headers = () => (Platform.OS === 'web'
  ? {}
  : { 'User-Agent': `${APP_NAME}/${APP_VERSION}${CONTACT ? ` (${CONTACT})` : ''}`, Accept: 'application/json' });

// GET con límite de tiempo; cualquier fallo se convierte en TransitousError (nunca lanza otra cosa)
async function getJson(url, ms = 15000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctl && ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: headers(), ...(ctl ? { signal: ctl.signal } : {}) });
    if (!r.ok) throw new TransitousError('http', `HTTP ${r.status}`);
    try { return await r.json(); } catch (e) { throw new TransitousError('format', 'JSON no válido'); }
  } catch (e) {
    if (e instanceof TransitousError) throw e;
    if (e && e.name === 'AbortError') throw new TransitousError('timeout', 'Tiempo agotado');
    throw new TransitousError('offline', String((e && e.message) || e));
  } finally { clearTimeout(timer); }
}

// ---- Caché (memoria + AsyncStorage) ----
const mem = new Map();
async function cacheGet(key, ttl) {
  try {
    let item = mem.get(key);
    if (!item) { const raw = await AsyncStorage.getItem(key); item = raw ? JSON.parse(raw) : null; }
    if (item && Date.now() - item.t < ttl) { mem.set(key, item); return item.v; }
  } catch (e) { /* sin caché */ }
  return null;
}
async function cacheSet(key, v) {
  const item = { t: Date.now(), v };
  mem.set(key, item);
  try { await AsyncStorage.setItem(key, JSON.stringify(item)); } catch (e) { /* ignorar */ }
}
async function countToday() {
  const day = new Date().toISOString().slice(0, 10);
  const key = `tr:count:${day}`;
  let n = 0;
  try { n = Number(await AsyncStorage.getItem(key)) || 0; } catch (e) { /* ignorar */ }
  if (n >= DAILY_LIMIT) throw new TransitousError('limit', 'Límite diario');
  try { await AsyncStorage.setItem(key, String(n + 1)); } catch (e) { /* ignorar */ }
}

// ---- Buscar un lugar por texto (geocoding de Transitous) ----
const areaLabel = (p) => {
  const areas = Array.isArray(p.areas) ? p.areas : [];
  const city = (areas.find((a) => a.default) || areas.filter((a) => a.adminLevel <= 8).pop() || {}).name;
  return [city, p.country].filter(Boolean).join(', ');
};

export async function geocode(text) {
  const q = String(text || '').trim();
  if (q.length < 2) return [];
  const key = `tr:geo:${q.toLowerCase()}`;
  const cached = await cacheGet(key, GEO_TTL);
  if (cached) return cached;
  const data = await getJson(`${API_BASE}/v1/geocode?text=${encodeURIComponent(q)}&language=es`);
  if (!Array.isArray(data)) throw new TransitousError('format', 'Respuesta no válida');
  const seen = new Set();
  const list = [];
  for (const p of data) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !p.name) continue;
    const dedupe = `${p.name}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    list.push({ id: p.id || dedupe, name: p.name, lat: p.lat, lon: p.lon, type: p.type, tz: p.tz || '', place: areaLabel(p) });
    if (list.length >= 8) break;
  }
  if (list.length) await cacheSet(key, list);
  return list;
}

// ---- Zonas horarias: la hora que elige el usuario es la del lugar de salida ----
function tzOffsetMinutes(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs) / 60000);
}
// "2026-12-01" + "08:30" en la zona tz -> "2026-12-01T07:30:00Z"
export function localToUtcIso(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = new Date(y, m - 1, d, h, mi).getTime(); // si no hay zona: hora del dispositivo
  try {
    if (tz) {
      let off = tzOffsetMinutes(guess, tz);
      utc = guess - off * 60000;
      off = tzOffsetMinutes(utc, tz); // segunda pasada por si hay cambio de hora
      utc = guess - off * 60000;
    }
  } catch (e) { /* Intl sin zonas: se usa la hora del dispositivo */ }
  return new Date(utc).toISOString().replace('.000Z', 'Z');
}
export function fmtTime(iso, tz) {
  try {
    return new Intl.DateTimeFormat('es-ES', { ...(tz ? { timeZone: tz } : {}), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  } catch (e) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
export const fmtDur = (min) => {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
};

// ---- Modos de transporte de MOTIS -> texto en español ----
export function modeLabel(mode) {
  const m = String(mode || '').toUpperCase();
  if (m === 'WALK') return 'A pie';
  if (m === 'BIKE' || m === 'RENTAL') return 'Bici';
  if (m === 'CAR') return 'Coche';
  if (m === 'AIRPLANE') return 'Avión';
  if (m === 'FERRY') return 'Barco';
  if (m === 'SUBWAY') return 'Metro';
  if (m === 'TRAM') return 'Tranvía';
  if (m === 'BUS' || m === 'COACH') return 'Autobús';
  if (m.includes('RAIL') || m === 'SUBURBAN' || m === 'LONG_DISTANCE') return 'Tren';
  return 'Transporte';
}
export const modeIcon = (mode) => ({ 'A pie': '🚶', Bici: '🚲', Coche: '🚗', Avión: '✈️', Barco: '⛴️', Metro: '🚇', Tranvía: '🚊', Autobús: '🚌', Tren: '🚆' }[modeLabel(mode)] || '🚍');

// ---- Consultar la ruta (plan) ----
// Convierte un itinerario de la respuesta en un objeto pequeño y fácil de guardar
function parseItinerary(it, from, to) {
  const name = (n, fallback) => (n && n !== 'START' && n !== 'END' ? n : fallback);
  const legs = (Array.isArray(it.legs) ? it.legs : []).map((l) => ({
    mode: l.mode || '',
    from: name(l.from && l.from.name, from.name),
    to: name(l.to && l.to.name, to.name),
    start: l.startTime || '',
    end: l.endTime || '',
    durationMin: Math.round((Number(l.duration) || 0) / 60),
    distance: Number.isFinite(l.distance) ? Math.round(l.distance) : null,
    line: l.routeShortName || l.displayName || '',
    headsign: l.headsign || '',
    agency: l.agencyName || '',
  }));
  return { start: it.startTime || '', end: it.endTime || '', durationMin: Math.round((Number(it.duration) || 0) / 60), transfers: Number.isFinite(it.transfers) ? it.transfers : 0, legs };
}

/**
 * Pide hasta 3 itinerarios de transporte público.
 * from / to: { name, lat, lon, tz? }; date "AAAA-MM-DD" y time "HH:MM" en la hora local de la salida.
 * force: salta la caché (botón Actualizar).
 * Devuelve { options: [itinerario...], tz }. Lanza TransitousError si algo falla.
 */
export async function planRoute({ from, to, date, time, force = false }) {
  const tz = from.tz || '';
  const when = localToUtcIso(date, time, tz);
  const f = `${from.lat.toFixed(5)},${from.lon.toFixed(5)}`;
  const t = `${to.lat.toFixed(5)},${to.lon.toFixed(5)}`;
  const key = `tr:plan:${f}|${t}|${when}`;
  if (!force) {
    const cached = await cacheGet(key, PLAN_TTL);
    if (cached) return { options: cached, tz };
  }
  await countToday();
  const data = await getJson(`${API_BASE}/v5/plan?fromPlace=${f}&toPlace=${t}&time=${encodeURIComponent(when)}&numItineraries=3&language=es`, 25000);
  const its = data && Array.isArray(data.itineraries) ? data.itineraries : null;
  if (!its) throw new TransitousError('format', 'Sin itinerarios');
  const options = its.map((it) => parseItinerary(it, from, to)).filter((o) => o.legs.length);
  if (!options.length) throw new TransitousError('empty', 'Sin rutas');
  await cacheSet(key, options);
  return { options, tz };
}

// Datos de la ruta que se rellenan a partir de un itinerario (duración, transportes y líneas)
export function summarize(option) {
  const modes = [];
  const lines = [];
  option.legs.forEach((l) => {
    const label = modeLabel(l.mode);
    if (!modes.includes(label)) modes.push(label);
    if (l.mode !== 'WALK' && l.line && !lines.includes(l.line)) lines.push(l.line);
  });
  return { duration: fmtDur(option.durationMin), transports: modes, lines: lines.join(', ') };
}
