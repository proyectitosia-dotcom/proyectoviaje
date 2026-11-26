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
// Nombre del país en español a partir de su código (ES -> España)
const PAISES = { ES: 'España', FR: 'Francia', IT: 'Italia', PT: 'Portugal', DE: 'Alemania', GB: 'Reino Unido', NL: 'Países Bajos', BE: 'Bélgica', CH: 'Suiza', AT: 'Austria', IE: 'Irlanda', LU: 'Luxemburgo', DK: 'Dinamarca', SE: 'Suecia', NO: 'Noruega', FI: 'Finlandia', PL: 'Polonia', CZ: 'Chequia', HU: 'Hungría', GR: 'Grecia', HR: 'Croacia', SI: 'Eslovenia', SK: 'Eslovaquia', RO: 'Rumanía', BG: 'Bulgaria', US: 'Estados Unidos', CA: 'Canadá', MX: 'México', JP: 'Japón', AD: 'Andorra', MC: 'Mónaco' };
const countryName = (code) => {
  if (!code) return '';
  const c = String(code).toUpperCase();
  try { const n = new Intl.DisplayNames(['es'], { type: 'region' }).of(c); if (n && n !== c) return n; } catch (e) { /* sin Intl.DisplayNames */ }
  return PAISES[c] || c;
};
const areaLabel = (p) => {
  const areas = Array.isArray(p.areas) ? p.areas : [];
  const city = (areas.find((a) => a.default) || areas.filter((a) => a.adminLevel <= 8).pop() || {}).name;
  return [city, countryName(p.country)].filter(Boolean).join(', ');
};

export async function geocode(text) {
  const q = String(text || '').trim();
  if (q.length < 2) return [];
  const key = `tr:geo2:${q.toLowerCase()}`; // geo2: la caché anterior tenía los países como código (ES)
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

// ---- Trazado de cada tramo (para el mapa) ----
// Transitous da la geometría como "polyline" codificada (precisión 6). Se decodifica y se simplifica
// para guardar pocos puntos por tramo (el mapa es pequeño y no hace falta más detalle).
function decodePolyline(str, precision = 6) {
  const f = Math.pow(10, precision);
  const out = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    let b, shift = 0, res = 0;
    do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
    lat += res & 1 ? ~(res >> 1) : res >> 1;
    shift = 0; res = 0;
    do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
    lon += res & 1 ? ~(res >> 1) : res >> 1;
    out.push([lat / f, lon / f]);
  }
  return out;
}
// Douglas-Peucker: se queda con los puntos que más importan
function douglasPeucker(pts, eps) {
  const last = pts.length - 1;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[last] = 1;
  const stack = [[0, last]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ay, ax] = pts[a], [by, bx] = pts[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [py, px] = pts[i];
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyTo(pts, maxPts) {
  if (pts.length <= maxPts) return pts;
  let eps = 1e-5;
  let r = pts;
  for (let i = 0; i < 14; i++) { r = douglasPeucker(pts, eps); if (r.length <= maxPts) return r; eps *= 2; }
  return r.slice(0, maxPts);
}
// Lista plana [lat, lon, lat, lon, ...] con 5 decimales (unos 1 m): ocupa poco al guardarla
function legGeo(g) {
  try {
    if (!g || typeof g.points !== 'string') return [];
    const pts = simplifyTo(decodePolyline(g.points, Number.isFinite(g.precision) ? g.precision : 6), 80);
    const flat = [];
    pts.forEach(([la, lo]) => flat.push(Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5));
    return flat;
  } catch (e) { return []; }
}

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
    // Coordenadas de salida y llegada del tramo y su trazado, para dibujarlo en el mapa
    fromLat: l.from && Number.isFinite(l.from.lat) ? l.from.lat : null,
    fromLon: l.from && Number.isFinite(l.from.lon) ? l.from.lon : null,
    toLat: l.to && Number.isFinite(l.to.lat) ? l.to.lat : null,
    toLon: l.to && Number.isFinite(l.to.lon) ? l.to.lon : null,
    geo: legGeo(l.legGeometry),
  }));
  return { start: it.startTime || '', end: it.endTime || '', durationMin: Math.round((Number(it.duration) || 0) / 60), transfers: Number.isFinite(it.transfers) ? it.transfers : 0, legs };
}

/**
 * Consulta rutas de transporte público.
 * from / to: { name, lat, lon, tz? }; date "AAAA-MM-DD".
 * time "HH:MM" (hora local de la salida): opcional.
 *   - Con hora: hasta 3 opciones a partir de esa hora.
 *   - Sin hora: TODAS las salidas de ese día (de las 00:00 a las 24:00, hora local), ordenadas por salida.
 * force: salta la caché (botón Actualizar).
 * Devuelve { options: [itinerario...], tz, day }. Lanza TransitousError si algo falla.
 */
export async function planRoute({ from, to, date, time, force = false }) {
  const tz = from.tz || '';
  const day = !time; // sin hora: todo el día
  const when = localToUtcIso(date, time || '00:00', tz);
  const f = `${from.lat.toFixed(5)},${from.lon.toFixed(5)}`;
  const t = `${to.lat.toFixed(5)},${to.lon.toFixed(5)}`;
  const key = `tr:plan:${f}|${t}|${when}|${day ? 'day' : 'n'}`;
  if (!force) {
    const cached = await cacheGet(key, PLAN_TTL);
    if (cached) return { options: cached, tz, day };
  }
  await countToday();
  // Una sola petición: con "searchWindow" de 24 h Transitous devuelve todas las salidas del día
  const extra = day ? 'searchWindow=86400' : 'numItineraries=3';
  const data = await getJson(`${API_BASE}/v5/plan?fromPlace=${f}&toPlace=${t}&time=${encodeURIComponent(when)}&${extra}&language=es`, day ? 40000 : 25000);
  const its = data && Array.isArray(data.itineraries) ? data.itineraries : null;
  if (!its) throw new TransitousError('format', 'Sin itinerarios');
  const end = new Date(when).getTime() + 86400000;
  let options = its.map((it) => parseItinerary(it, from, to)).filter((o) => o.legs.length);
  if (day) options = options.filter((o) => { const st = new Date(o.start).getTime(); return st >= new Date(when).getTime() && st < end; }); // solo salidas de ese día
  options.sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!options.length) throw new TransitousError('empty', 'Sin rutas');
  await cacheSet(key, options);
  return { options, tz, day };
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
