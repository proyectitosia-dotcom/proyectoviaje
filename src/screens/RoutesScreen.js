import React, { useState } from 'react';
import { ScrollView, View, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, H, Field, Btn, Row, LinkText, Chip, Label, Muted, confirm, notify , Text, DateField, useTheme } from '../components/ui';
import { uid } from '../store';
import { money, num, googleMapsRouteUrl, fmtDMY } from '../utils';
import { useTripRange, inRange } from '../tripRange';
import { isMapsLink, openExternal as openUrl, routeMapsUrl } from '../links';
import PlaceSearch from '../components/PlaceSearch';
import PlanView from '../components/PlanView';
import RouteMap from '../components/RouteMap';
import CurrencyField from '../components/CurrencyField';
import { useRates } from '../currency';
import { planRoute, summarize, errorMessage, SOURCES_URL, fmtTime as _fmtTime, fmtDur as _fmtDur } from '../transitous';

const TRANSPORTS = ['Avión', 'Tren', 'Autobús', 'Metro', 'Tranvía', 'Coche', 'Taxi', 'Barco', 'A pie', 'Bici'];
const MODES = [['transit', 'Transporte público'], ['driving', 'Coche'], ['walking', 'A pie'], ['bicycling', 'Bici']];
// Formulario vacío de ruta. from/to son los lugares elegidos con Transitous (nombre, lat, lon, zona horaria).
const makeEmpty = (date = '') => ({ name: '', originText: '', destText: '', from: null, to: null, stops: '', date, time: '', duration: '', cost: '', currency: 'EUR', transports: [], lines: '', mode: 'transit', mapUrl: '', plan: null, section: 'general' });

const validDate = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
};
// Secciones de la pestaña: la ruta general (entra en el enlace de la ruta completa de Google Maps) y otras rutas (no entra)
const SECTIONS = [['general', 'Ruta general'], ['otras', 'Otras rutas']];
const sectionOf = (r) => (r && r.section === 'otras' ? 'otras' : 'general');
const validTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const MAX_WP = 9;
// Datos antiguos o incompletos: nunca asumir que un campo existe o es del tipo esperado
const arr = (v) => (Array.isArray(v) ? v : []);
const txt = (v) => String(v ?? '').trim();

// Puntos intermedios de la ruta completa: paradas y puntos de enlace entre trayectos
function fullRoute(routes) {
  const wps = [];
  const push = (p) => { const v = (p || '').trim(); if (v && wps[wps.length - 1] !== v) wps.push(v); };
  routes.forEach((r, i) => {
    if (i > 0) {
      const prev = routes[i - 1].destination;
      push(prev);
      if ((r.origin || '').trim() !== (prev || '').trim()) push(r.origin);
    }
    arr(r.stops).forEach(push);
  });
  const origin = routes[0].origin;
  const destination = routes[routes.length - 1].destination;
  const inner = wps.filter((w) => w !== origin && w !== destination);
  return { origin, destination, all: inner };
}


// "08:24 · 3 h 25 min" para los botones de opción
const fmtTimeShort = (o, tz) => `${_fmtTime(o.start, tz)} · ${_fmtDur(o.durationMin)}`;

export default function RoutesScreen({ trip, update }) {
  const range = useTripRange();
  const { colors } = useTheme();
  const rates = useRates(trip, update); // cambios de divisa del viaje (compartido con Gastos: src/currency.js)
  const [form, setForm] = useState(null);
  const [results, setResults] = useState(null);   // itinerarios devueltos por Transitous al consultar
  const [picked, setPicked] = useState(0);        // opción elegida (0, 1 o 2)
  const [busy, setBusy] = useState(false);        // consultando Transitous
  const [planError, setPlanError] = useState(''); // mensaje si la consulta falla
  const [refreshing, setRefreshing] = useState(null); // id de la ruta que se está actualizando
  const [mapOpen, setMapOpen] = useState(null);       // id de la ruta cuyo mapa está abierto (solo uno a la vez)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const allRoutes = arr(trip.routes).filter(Boolean);
  const [section, setSection] = useState('general'); // pestaña interna: ruta general / otras rutas
  const routes = allRoutes.filter((r) => sectionOf(r) === section); // las de la sección abierta

  const openForm = (f) => { setForm(f); setResults(null); setPicked(0); setPlanError(''); };
  const closeForm = () => { setForm(null); setResults(null); setPlanError(''); };

  // Rellena el formulario con un itinerario elegido: lo guarda y completa duración, transportes y líneas
  const applyOption = (opt, tz) => setForm((f) => ({ ...f, plan: { ...opt, tz, fetchedAt: Date.now() }, ...summarize(opt) }));

  // Consulta Transitous con los lugares, la fecha y la hora del formulario
  const consult = async () => {
    if (busy) return;
    if (!form.from || !form.to) return notify('Faltan lugares', 'Busca y elige el origen y el destino con "Buscar lugar".');
    if (!validDate(txt(form.date))) return notify('Falta la fecha', 'Elige la fecha de salida en el calendario.');
    // La hora es opcional: sin hora se muestran todas las salidas de ese día
    if (txt(form.time) && !validTime(txt(form.time))) return notify('Hora no válida', 'Usa el formato HH:MM de 24 horas, por ejemplo 08:30, o déjala vacía para ver todas las salidas del día.');
    setBusy(true); setPlanError('');
    try {
      const { options, tz, day } = await planRoute({ from: form.from, to: form.to, date: txt(form.date), time: txt(form.time) });
      setResults({ options, tz, day }); setPicked(0);
      applyOption(options[0], tz);
    } catch (e) {
      setResults(null);
      setPlanError(`${errorMessage(e)} Puedes rellenar la duración y el precio a mano.`);
    } finally { setBusy(false); }
  };

  const save = () => {
    const origin = txt(form.originText);
    const destination = txt(form.destText);
    if (!origin || !destination) return notify('Faltan datos', 'El origen y el destino son obligatorios.');
    const date = txt(form.date);
    const time = txt(form.time);
    if (date && !validDate(date)) return notify('Fecha no válida', 'Elige la fecha en el calendario.');
    if (date && !inRange(date, range)) return notify('Fecha fuera del viaje', 'La fecha tiene que estar dentro de las fechas del viaje.');
    if (time && !validTime(time)) return notify('Hora no válida', 'Usa el formato HH:MM de 24 horas, por ejemplo 08:30.');
    const cost = num(form.cost);
    if (cost < 0) return notify('Coste no válido', 'El coste no puede ser negativo.');
    const mapUrl = txt(form.mapUrl);
    if (mapUrl && !isMapsLink(mapUrl)) return notify('Enlace no válido', 'Pega un enlace de Google Maps (https://www.google.com/maps/... o https://maps.app.goo.gl/...).');
    // El coste se escribe en la divisa elegida; se guarda SIEMPRE en euros (cost) y, si no es euro, el importe original (orig)
    const { eur, orig } = rates.convert(form.cost, form.currency);
    const { originText, destText, currency, ...rest } = form;
    const r = { ...rest, section: sectionOf(form), origin, destination, date, time, mapUrl, stops: txt(form.stops).split(',').map((x) => x.trim()).filter(Boolean), cost: eur, duration: txt(form.duration), lines: txt(form.lines) };
    if (orig) r.orig = orig; else delete r.orig; // Firestore no admite undefined
    const list = form.id ? allRoutes.map((x) => (x.id === form.id ? r : x)) : [...allRoutes, { ...r, id: uid() }];
    list.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    update({ routes: list });
    closeForm();
  };
  const edit = (r) => openForm({ ...makeEmpty(), ...r, originText: txt(r.origin), destText: txt(r.destination), from: r.from || null, to: r.to || null, date: txt(r.date), time: txt(r.time), duration: txt(r.duration), lines: txt(r.lines), mapUrl: txt(r.mapUrl), stops: arr(r.stops).join(', '), transports: arr(r.transports), cost: r.orig && r.orig.currency ? String(r.orig.amount ?? '') : String(r.cost ?? ''), currency: r.orig && r.orig.currency ? r.orig.currency : 'EUR', plan: r.plan || null, section: sectionOf(r) });
  const remove = (r) => confirm('¿Eliminar esta ruta?', () => update({ routes: allRoutes.filter((x) => x.id !== r.id) }));

  // Botón "Actualizar": vuelve a consultar Transitous con los datos guardados (máximo una vez por minuto)
  const refresh = async (r) => {
    if (refreshing) return;
    if (!r.from || !r.to || !validDate(txt(r.date)) || (txt(r.time) && !validTime(txt(r.time)))) {
      return notify('No se puede actualizar', 'Esta ruta no tiene lugares buscados con Transitous y una fecha. Edítala y pulsa "Consultar ruta".');
    }
    if (r.plan && r.plan.fetchedAt && Date.now() - r.plan.fetchedAt < 60000) return notify('Acabas de consultarla', 'Espera un minuto antes de actualizar otra vez.');
    setRefreshing(r.id);
    try {
      const { options, tz } = await planRoute({ from: r.from, to: r.to, date: r.date, time: r.time, force: true });
      // Sin hora, se conserva la misma salida elegida si sigue existiendo; si no, la primera
      const opt = (r.plan && options.find((o) => o.start === r.plan.start)) || options[0];
      update({ routes: allRoutes.map((x) => (x.id === r.id ? { ...x, plan: { ...opt, tz, fetchedAt: Date.now() }, ...summarize(opt) } : x)) });
    } catch (e) {
      notify('No se pudo actualizar', `${errorMessage(e)} Se mantienen los datos guardados.`);
    } finally { setRefreshing(null); }
  };

  const full = section === 'general' && routes.length > 1 ? fullRoute(routes) : null;
  const total = routes.reduce((a, r) => a + num(r.cost), 0);

  // Formulario del trayecto (se muestra en línea al añadir y en una ventana flotante al editar)
  const formView = form ? (
        <Card>
          <H>{form.id ? 'Editar trayecto' : 'Nuevo trayecto'}</H>
          <Label>Apartado</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {SECTIONS.map(([k, label]) => <Chip key={k} title={label} active={sectionOf(form) === k} onPress={() => set('section', k)} />)}
          </View>
          <Field label="Nombre (opcional)" value={form.name} onChangeText={(v) => set('name', v)} placeholder="Ej. Madrid → Barcelona" />
          <PlaceSearch label="Origen *" text={form.originText} onText={(v) => set('originText', v)} place={form.from} onPick={(p) => { set('from', p); if (results) setResults(null); }} />
          <PlaceSearch label="Destino *" text={form.destText} onText={(v) => set('destText', v)} place={form.to} onPick={(p) => { set('to', p); if (results) setResults(null); }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><DateField label="Fecha de salida" value={form.date} onChange={(v) => set('date', v)} /></View>
            <View style={{ flex: 1 }}><Field label="Hora salida (opcional)" value={form.time} onChangeText={(v) => set('time', v)} placeholder="Sin hora: todo el día" keyboardType="numbers-and-punctuation" /></View>
          </View>
          <Btn kind="ok" title={busy ? 'Consultando…' : '🚆 Consultar ruta (Transitous)'} onPress={consult} />
          {planError ? <Muted>{planError}</Muted> : null}

          {results && results.options.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <Label>{results.day ? `Todas las salidas de ese día (${results.options.length}). Elige una:` : 'Elige una opción:'}</Label>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 300, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
                {results.options.map((o, i) => {
                  const sm = summarize(o);
                  return (
                    <TouchableOpacity key={`${o.start}-${i}`} onPress={() => { setPicked(i); applyOption(o, results.tz); }}
                      style={{ padding: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.border, backgroundColor: picked === i ? colors.bg : 'transparent' }}>
                      <Text style={{ fontWeight: picked === i ? '700' : '600' }}>{picked === i ? '✔ ' : ''}{_fmtTime(o.start, results.tz)} → {_fmtTime(o.end, results.tz)} · {_fmtDur(o.durationMin)}</Text>
                      <Muted>{o.transfers === 0 ? 'Sin transbordos' : `${o.transfers} transbordo${o.transfers > 1 ? 's' : ''}`}{sm.lines ? ` · Líneas: ${sm.lines}` : ' · A pie'}</Muted>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
          {form.plan ? <Card style={{ marginTop: 6, marginBottom: 4 }}><PlanView plan={form.plan} tz={form.plan.tz} /><RouteMap plan={form.plan} from={form.from} to={form.to} /></Card> : null}

          <Label>Datos manuales (se rellenan solos al consultar; edítalos si hace falta)</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Duración" value={form.duration} onChangeText={(v) => set('duration', v)} placeholder="6h 30min" /></View>
            <View style={{ flex: 1 }}><Field label="Precio · a mano" value={form.cost} onChangeText={(v) => set('cost', v)} keyboardType="decimal-pad" /></View>
          </View>
          <CurrencyField currency={form.currency} amount={form.cost} rates={rates} onChange={(c) => set('currency', c)} label="Divisa del precio" />
          <Muted>Transitous no da el precio: escríbelo tú.</Muted>
          <Label>Tipo de transporte</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TRANSPORTS.map((t) => (
              <Chip key={t} title={t} active={arr(form.transports).includes(t)}
                onPress={() => set('transports', arr(form.transports).includes(t) ? arr(form.transports).filter((x) => x !== t) : [...arr(form.transports), t])} />
            ))}
          </View>
          <Field label="Líneas utilizadas" value={form.lines} onChangeText={(v) => set('lines', v)} placeholder="AVE 03071, Metro L1, Bus 27" />
          <Field label="Paradas intermedias (opcional, separadas por comas)" value={form.stops} onChangeText={(v) => set('stops', v)} placeholder="Zaragoza, Barcelona" />
          <Field label="Enlace de Google Maps (opcional)" value={form.mapUrl} onChangeText={(v) => set('mapUrl', v)} autoCapitalize="none" placeholder="https://maps.app.goo.gl/..." />
          <Btn title="Guardar" onPress={save} />
          <Btn title="Cancelar" kind="outline" onPress={closeForm} />
        </Card>
  ) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      {/* Dos apartados: la ruta general y otras rutas (estas últimas NO se añaden a la ruta general de Google Maps) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {SECTIONS.map(([k, label]) => (
          <Chip key={k} title={`${label} (${allRoutes.filter((r) => sectionOf(r) === k).length})`} active={section === k} onPress={() => { if (!form) setSection(k); }} />
        ))}
      </View>
      <Card>
        <H>{section === 'general' ? 'Ruta general del viaje' : 'Otras rutas'}</H>
        <Row label="Trayectos" value={routes.length} />
        <Row label="Coste total" value={money(total)} />
        {section === 'general' && full && (
          <>
            <LinkText url={googleMapsRouteUrl(full.origin, full.destination, full.all.slice(0, MAX_WP), 'driving')}>
              Ver ruta completa en Google Maps
            </LinkText>
            {full.all.length > MAX_WP && (
              <Muted>Google Maps admite máximo {MAX_WP} paradas intermedias: se han omitido {full.all.length - MAX_WP} del enlace de la ruta completa.</Muted>
            )}
          </>
        )}
        {section === 'otras' && <Muted>Estas rutas son aparte: no se añaden a la ruta completa de Google Maps de la ruta general. Cada una tiene su propio botón «Abrir en Google Maps».</Muted>}
        {!form && <Btn title="+ Añadir trayecto" onPress={() => openForm({ ...makeEmpty(range.start), section })} />}
      </Card>

      {/* Añadir: el formulario va en línea; al editar se abre en una ventana flotante que se cierra al guardar o cancelar */}
      {form && !form.id && formView}
      {form && form.id && (
        <Modal visible animationType="slide" transparent onRequestClose={closeForm}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
            <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ maxHeight: '92%', marginHorizontal: 10, borderRadius: 12, backgroundColor: colors.bg, overflow: 'hidden' }}>
                <ScrollView contentContainerStyle={{ padding: 10 }} keyboardShouldPersistTaps="handled">{formView}</ScrollView>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {routes.map((r, i) => (
        <Card key={r.id || i}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{i + 1}. {r.name || `${txt(r.origin)} → ${txt(r.destination)}`}</Text>
          <Muted>{r.date ? fmtDMY(r.date) : 'Sin fecha'}{r.time ? ` · ${r.time}` : ''}</Muted>
          <Row label="Origen" value={txt(r.origin)} />
          {arr(r.stops).length > 0 && <Row label="Paradas" value={arr(r.stops).join(' → ')} />}
          <Row label="Destino" value={txt(r.destination)} />
          {r.plan && Array.isArray(r.plan.legs) ? (
            <View>
              <PlanView plan={r.plan} tz={r.plan.tz} />
              {mapOpen === r.id ? <RouteMap plan={r.plan} from={r.from} to={r.to} /> : null}
              {r.plan.fetchedAt ? <Muted>Consultado el {new Date(r.plan.fetchedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · Transitous</Muted> : null}
            </View>
          ) : (
            <>
              <Row label="Duración" value={txt(r.duration) || '-'} />
              <Row label="Transporte" value={arr(r.transports).join(', ') || '-'} />
              <Row label="Líneas" value={txt(r.lines) || '-'} />
            </>
          )}
          <Row label="Precio" value={`${money(r.cost)}${r.orig && r.orig.currency ? ` (${r.orig.amount} ${r.orig.currency})` : ''}`} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn small title="Abrir en Google Maps" onPress={() => openUrl(routeMapsUrl(r))} style={{ flex: 1 }} />
            <Btn small kind="outline" title={refreshing === r.id ? 'Actualizando…' : '🔄 Actualizar'} onPress={() => refresh(r)} style={{ flex: 1 }} />
            {r.plan && Array.isArray(r.plan.legs) ? <Btn small kind="outline" title={mapOpen === r.id ? '🗺️ Ocultar mapa' : '🗺️ Ver mapa'} onPress={() => setMapOpen(mapOpen === r.id ? null : r.id)} style={{ flex: 1 }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small title="Editar" kind="outline" onPress={() => edit(r)} style={{ flex: 1 }} />
            <Btn small title="Eliminar" kind="danger" onPress={() => remove(r)} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}

      {/* Atribución obligatoria de Transitous y OpenStreetMap */}
      <Muted>
        Rutas de transporte público con Transitous (datos abiertos). Fuentes de datos: {' '}
        <Text style={{ textDecorationLine: 'underline' }} onPress={() => openUrl(SOURCES_URL)}>transitous.org/sources</Text>
        {' '}· Mapas y lugares © OpenStreetMap contributors.
      </Muted>
    </ScrollView>
  );
}
