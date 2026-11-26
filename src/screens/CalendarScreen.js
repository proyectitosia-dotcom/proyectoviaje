// Pestaña Calendario.
//  1) Primera vez: pantalla "Crear tu calendario".
//  2) Crear / editar: elegir un día del viaje, escribir su plan, agendar eventos (con hora, lugar y
//     enlace opcional de ubicación de Google Maps) y asignar rutas.
//  3) Después: "Mi viaje", una agenda parecida a Google Calendar con todos los días del viaje.
// Los días del calendario son SOLO los del rango del viaje (fecha de inicio a fecha de fin).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { Card, H, Field, Btn, Chip, Muted, confirm, notify, Text, useTheme, useStyles } from '../components/ui';
import { uid } from '../store';
import { addDays, formatDate, fmtDM, fmtDMY, todayISO } from '../utils';
import { daysInRange } from '../tripRange';
import { isMapsLink, openExternal, routeMapsUrl } from '../links';

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const byTime = (a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || '').localeCompare(b.time || '');
const arr = (v) => (Array.isArray(v) ? v : []);

// Días guardados con su fecha. Los antiguos (solo número de día) se enlazan a su fecha según el inicio del viaje.
function stampDays(days, start) {
  return arr(days).map((d) => (d.date ? d : { ...d, date: addDays(start, Math.max(0, (Number(d.number) || 1) - 1)) || '' }));
}

export default function CalendarScreen({ trip, update }) {
  const dates = useMemo(() => daysInRange(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const days = useMemo(() => stampDays(trip.days, trip.startDate), [trip.days, trip.startDate]);
  const [editing, setEditing] = useState(false);

  // Guarda un cambio en el día de una fecha (lo crea si aún no existía); el resto de días se conserva
  const saveDay = (date, patch) => {
    const list = [...days];
    const i = list.findIndex((d) => d.date === date);
    if (i >= 0) list[i] = { ...list[i], ...patch };
    else list.push({ id: uid(), date, number: dates.indexOf(date) + 1, plan: '', routeIds: [], events: [], ...patch });
    update({ days: list });
  };
  const recOf = (date) => days.find((d) => d.date === date) || { id: '', date, plan: '', routeIds: [], events: [] };

  if (!dates.length) return <View style={{ padding: 14 }}><Card><Muted>Elige primero las fechas del viaje.</Muted></Card></View>;

  // 1) Primera vez: "Crear tu calendario"
  if (!trip.calendarCreated && !editing) {
    return (
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        <Card>
          <H>📅 Crear tu calendario</H>
          <Muted>Tu viaje va del {fmtDMY(trip.startDate)} al {fmtDMY(trip.endDate)} ({dates.length} {dates.length === 1 ? 'día' : 'días'}). Añade el plan de cada día y agenda eventos con su hora y su ubicación. Al terminar se guardará como «Mi viaje».</Muted>
          <Btn title="Crear tu calendario" onPress={() => setEditing(true)} />
        </Card>
      </ScrollView>
    );
  }

  // 2) Crear o editar
  if (editing || !trip.calendarCreated) {
    return (
      <EditView
        trip={trip} dates={dates} recOf={recOf} saveDay={saveDay}
        created={!!trip.calendarCreated}
        onDone={() => { if (!trip.calendarCreated) update({ calendarCreated: true }); setEditing(false); }}
      />
    );
  }

  // 3) "Mi viaje"
  return <AgendaView trip={trip} dates={dates} recOf={recOf} onEdit={() => setEditing(true)} />;
}

// ---------------------------------------------------------------------------------------------
// "Mi viaje": agenda de todos los días con sus eventos ordenados por hora
// ---------------------------------------------------------------------------------------------
function AgendaView({ trip, dates, recOf, onEdit }) {
  const { colors } = useTheme();
  const st = useStyles(makeStyles);
  const [openPlans, setOpenPlans] = useState({}); // días con el plan desplegado
  const routes = arr(trip.routes);
  const today = todayISO();

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <H>🗓️ Mi viaje</H>
        <Text style={{ fontWeight: '600' }}>{fmtDMY(trip.startDate)} → {fmtDMY(trip.endDate)}</Text>
        <Muted>Inicio: {fmtDMY(trip.startDate)} · Fin: {fmtDMY(trip.endDate)} · {dates.length} {dates.length === 1 ? 'día' : 'días'}</Muted>
        <Btn small kind="outline" title="✏️ Editar calendario" onPress={onEdit} />
      </Card>

      {dates.map((date, i) => {
        const d = recOf(date);
        const events = arr(d.events).slice().sort(byTime);
        const dayRoutes = routes.filter((r) => arr(d.routeIds).includes(r.id));
        const empty = !events.length && !d.plan && !dayRoutes.length;
        return (
          <Card key={date} style={date === today ? { borderWidth: 2, borderColor: colors.primary } : null}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontWeight: '700', fontSize: 16, textTransform: 'capitalize' }}>{formatDate(date)}</Text>
              <Muted>Día {i + 1} · {fmtDMY(date)}</Muted>
            </View>
            {empty ? <Muted>Sin planes</Muted> : null}
            {events.map((e) => (
              <View key={e.id} style={st.agendaEvent}>
                <Text style={st.agendaTime}>{e.time || 'Todo el día'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600' }}>{e.title}</Text>
                  {e.place ? <Muted>📍 {e.place}</Muted> : null}
                  {/* Solo si el evento tiene enlace de ubicación */}
                  {e.mapUrl ? <Btn small kind="outline" title="Ver en Google Maps" onPress={() => openExternal(e.mapUrl)} style={{ alignSelf: 'flex-start' }} /> : null}
                </View>
              </View>
            ))}
            {dayRoutes.map((r) => (
              <View key={r.id} style={st.agendaEvent}>
                <Text style={st.agendaTime}>{r.time || '🚆'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600' }}>🚆 {r.name || `${r.origin} → ${r.destination}`}</Text>
                  <Muted>{arr(r.transports).join(', ')}{r.lines ? ` (${r.lines})` : ''}</Muted>
                  <Btn small kind="outline" title="Ver ruta en Google Maps" onPress={() => openExternal(routeMapsUrl(r))} style={{ alignSelf: 'flex-start' }} />
                </View>
              </View>
            ))}
            {d.plan ? (
              <View style={{ marginTop: 6 }}>
                <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => setOpenPlans({ ...openPlans, [date]: !openPlans[date] })}>
                  📝 {openPlans[date] ? 'Ocultar plan del día' : 'Ver plan del día'}
                </Text>
                {openPlans[date] ? <Text style={{ marginTop: 4 }}>{d.plan}</Text> : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------------------------
// Crear / editar el calendario: un día, su plan, sus eventos y sus rutas
// ---------------------------------------------------------------------------------------------
const emptyEvent = { id: '', title: '', time: '', place: '', mapUrl: '' };

function EditView({ trip, dates, recOf, saveDay, created, onDone }) {
  const { colors } = useTheme();
  const st = useStyles(makeStyles);
  const [sel, setSel] = useState(dates[0]);
  const date = dates.includes(sel) ? sel : dates[0];
  const day = recOf(date);
  const [ev, setEv] = useState(emptyEvent);          // formulario de evento (id vacío = nuevo)
  const [planText, setPlanText] = useState(day.plan || '');
  const dirtyRef = useRef(false);
  // Sincroniza el plan con cambios remotos solo si no hay texto sin guardar
  useEffect(() => { if (!dirtyRef.current) setPlanText(day.plan || ''); }, [date, day.plan]);

  const events = arr(day.events);
  const savePlan = () => { if (dirtyRef.current) { saveDay(date, { plan: planText }); dirtyRef.current = false; } };
  const selectDay = (d) => {
    if (d === date) return;
    savePlan();
    dirtyRef.current = false;
    setSel(d); setEv(emptyEvent);
  };

  // Agendar un evento nuevo o guardar los cambios de uno existente
  const saveEvent = () => {
    const title = ev.title.trim();
    if (!title) return notify('Falta el título del evento');
    const time = ev.time.trim();
    let norm = '';
    if (time) {
      const m = TIME_RE.exec(time);
      if (!m) return notify('Hora no válida', 'Usa el formato HH:MM, por ejemplo 09:30.');
      norm = `${m[1].padStart(2, '0')}:${m[2]}`;
    }
    const mapUrl = ev.mapUrl.trim();
    if (mapUrl && !isMapsLink(mapUrl)) return notify('Enlace no válido', 'Pega un enlace de Google Maps (https://www.google.com/maps/... o https://maps.app.goo.gl/...).');
    const item = { id: ev.id || uid(), title, time: norm, place: ev.place.trim(), mapUrl };
    const list = ev.id ? events.map((x) => (x.id === ev.id ? item : x)) : [...events, item];
    saveDay(date, { events: list.sort(byTime), ...(dirtyRef.current ? { plan: planText } : {}) });
    dirtyRef.current = false;
    setEv(emptyEvent);
  };
  const removeEvent = (id) => { saveDay(date, { events: events.filter((x) => x.id !== id) }); if (ev.id === id) setEv(emptyEvent); };
  const toggleRoute = (rid) => saveDay(date, { routeIds: arr(day.routeIds).includes(rid) ? arr(day.routeIds).filter((x) => x !== rid) : [...arr(day.routeIds), rid] });
  const routes = arr(trip.routes);

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <H>{created ? '✏️ Editar tu calendario' : '📅 Creando tu calendario'}</H>
        <Muted>Viaje del {fmtDMY(trip.startDate)} al {fmtDMY(trip.endDate)}. Elige un día para añadir su plan y sus eventos.</Muted>
        <View style={st.grid}>
          {dates.map((d, i) => {
            const r = recOf(d);
            const has = r.plan || arr(r.events).length || arr(r.routeIds).length;
            return (
              <TouchableOpacity key={d} onPress={() => selectDay(d)} style={[st.cell, d === date && st.sel]}>
                <Text style={[st.num, d === date && { color: colors.onPrimary }]}>{i + 1}</Text>
                <Text style={[st.small, d === date && { color: colors.onPrimary }]}>{fmtDM(d)}</Text>
                {has ? <View style={st.dot} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <Btn title={created ? '✔ Listo' : '✔ Terminar y guardar como «Mi viaje»'} onPress={() => { savePlan(); onDone(); }} />
      </Card>

      <Card>
        <H>Día {dates.indexOf(date) + 1} · {formatDate(date)}</H>
        <Field label="Plan del día" multiline value={planText} onChangeText={(v) => { dirtyRef.current = true; setPlanText(v); }} onBlur={savePlan} placeholder="Visita al centro, comida en..." />
        <Btn small title="Guardar plan" kind="outline" onPress={savePlan} />

        <Text style={st.sub}>Eventos</Text>
        {events.slice().sort(byTime).map((e) => (
          <View key={e.id} style={st.event}>
            <View style={{ flex: 1 }}>
              <Text><Text style={{ fontWeight: '700' }}>{e.time || '--:--'}</Text>  {e.title}{e.place ? ` · ${e.place}` : ''}</Text>
              {e.mapUrl ? <Muted>📍 Con enlace de ubicación</Muted> : null}
            </View>
            <Text style={{ color: colors.primary, padding: 4 }} onPress={() => setEv({ id: e.id, title: e.title, time: e.time || '', place: e.place || '', mapUrl: e.mapUrl || '' })}>Editar</Text>
            <Text style={{ color: colors.danger, padding: 4 }} onPress={() => confirm('¿Quitar este evento?', () => removeEvent(e.id))}>✕</Text>
          </View>
        ))}
        {!events.length ? <Muted>Todavía no hay eventos este día.</Muted> : null}

        <Text style={st.sub}>{ev.id ? 'Editar evento' : 'Nuevo evento'}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 2 }}><Field placeholder="Evento" value={ev.title} onChangeText={(v) => setEv({ ...ev, title: v })} /></View>
          <View style={{ flex: 1 }}><Field placeholder="HH:MM" keyboardType="numbers-and-punctuation" maxLength={5} value={ev.time} onChangeText={(v) => setEv({ ...ev, time: v })} /></View>
        </View>
        <Field placeholder="Lugar (opcional)" value={ev.place} onChangeText={(v) => setEv({ ...ev, place: v })} />
        <Field placeholder="Enlace de ubicación de Google Maps (opcional)" autoCapitalize="none" value={ev.mapUrl} onChangeText={(v) => setEv({ ...ev, mapUrl: v })} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn small title={ev.id ? 'Guardar cambios' : 'Agendar evento'} kind="outline" onPress={saveEvent} style={{ flex: 1 }} />
          {ev.id ? <Btn small title="Cancelar" kind="outline" onPress={() => setEv(emptyEvent)} style={{ flex: 1 }} /> : null}
        </View>

        <Text style={st.sub}>Rutas del día</Text>
        {routes.length === 0 ? <Muted>Añade rutas en la pestaña "Ruta".</Muted> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {routes.map((r) => <Chip key={r.id} title={r.name || `${r.origin} → ${r.destination}`} active={arr(day.routeIds).includes(r.id)} onPress={() => toggleRoute(r.id)} />)}
          </View>
        )}
        {routes.filter((r) => arr(day.routeIds).includes(r.id)).map((r) => (
          <View key={r.id} style={{ marginTop: 4 }}>
            <Muted>{r.time || ''} {r.origin} → {r.destination} · {arr(r.transports).join(', ')} {r.lines ? `(${r.lines})` : ''}</Muted>
            <Btn small kind="outline" title="Abrir en Google Maps" onPress={() => openExternal(routeMapsUrl(r))} style={{ alignSelf: 'flex-start' }} />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const makeStyles = (colors) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 },
  cell: { width: '13%', margin: '0.6%', aspectRatio: 1, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  sel: { backgroundColor: colors.primary },
  num: { fontWeight: '700', color: colors.text },
  small: { fontSize: 9, color: colors.muted },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ok, marginTop: 2 },
  sub: { fontWeight: '700', marginTop: 10, marginBottom: 4 },
  event: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 6, padding: 8, marginBottom: 4 },
  agendaEvent: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border, marginTop: 6 },
  agendaTime: { width: 64, fontWeight: '700', color: colors.primary },
});
