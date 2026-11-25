import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card, H, Field, Btn, Chip, Label, Muted, LinkText, colors, confirm, notify } from '../components/ui';
import { uid } from '../store';
import { addDays, formatDate, googleMapsRouteUrl } from '../utils';

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const byTime = (a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || '').localeCompare(b.time || '');

export default function CalendarScreen({ trip, update }) {
  const days = trip.days || [];
  const [selId, setSelId] = useState(days[0]?.id);
  const [ev, setEv] = useState({ title: '', time: '', place: '' });
  const [startDate, setStartDate] = useState(trip.startDate || '');
  const idx = Math.max(0, days.findIndex((d) => d.id === selId));
  const day = days[idx];
  const [planText, setPlanText] = useState(day?.plan || '');
  const dirtyRef = useRef(false);
  // Sincroniza con cambios remotos solo si no hay texto sin guardar
  useEffect(() => { if (!dirtyRef.current) setPlanText(day?.plan || ''); }, [day?.id, day?.plan]);
  useEffect(() => { setStartDate(trip.startDate || ''); }, [trip.startDate]);
  const dateOf = (i) => (trip.startDate ? addDays(trip.startDate, i) : null);

  const renumber = (list) => list.map((d, i) => ({ ...d, number: i + 1 }));
  const saveDays = (list) => update({ days: renumber(list) });
  // Días con el plan pendiente aplicado al día actual
  const withPlan = () => (dirtyRef.current && day ? days.map((d) => (d.id === day.id ? { ...d, plan: planText } : d)) : days);
  const patchDay = (patch) => saveDays(withPlan().map((d) => (d.id === day.id ? { ...d, ...patch } : d)));
  const savePlan = () => { if (!day) return; patchDay({ plan: planText }); dirtyRef.current = false; };
  const selectDay = (id) => {
    if (id === day?.id) return;
    if (dirtyRef.current) { saveDays(withPlan()); dirtyRef.current = false; }
    setSelId(id);
  };
  const addDay = () => {
    const d = { id: uid(), number: days.length + 1, plan: '', routeIds: [], events: [] };
    saveDays([...withPlan(), d]); dirtyRef.current = false; setSelId(d.id);
  };
  const removeDay = () => confirm(`¿Quitar el día ${day.number}? Se perderán su plan y sus eventos.`, () => {
    const list = days.filter((d) => d.id !== day.id);
    dirtyRef.current = false;
    saveDays(list);
    setSelId(list[Math.max(0, idx - 1)]?.id);
  });
  const addEvent = () => {
    const title = ev.title.trim();
    if (!title) return notify('Falta el título del evento');
    const time = ev.time.trim();
    let norm = '';
    if (time) {
      const m = TIME_RE.exec(time);
      if (!m) return notify('Hora no válida', 'Usa el formato HH:MM, por ejemplo 09:30.');
      norm = `${m[1].padStart(2, '0')}:${m[2]}`;
    }
    const events = [...(day.events || []), { title, time: norm, place: ev.place.trim(), id: uid() }].sort(byTime);
    patchDay({ events });
    setEv({ title: '', time: '', place: '' });
  };
  const saveStart = () => {
    const v = startDate.trim();
    if (v && (!DATE_RE.test(v) || !addDays(v, 0))) return notify('Fecha no válida', 'Usa el formato AAAA-MM-DD.');
    update({ startDate: v });
  };
  const toggleRoute = (rid) => patchDay({ routeIds: day.routeIds?.includes(rid) ? day.routeIds.filter((x) => x !== rid) : [...(day.routeIds || []), rid] });

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Label>Fecha de inicio del viaje (día 1)</Label>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Field value={startDate} onChangeText={setStartDate} placeholder="AAAA-MM-DD" /></View>
          <Btn small title="Guardar" onPress={saveStart} />
        </View>
        <View style={st.grid}>
          {days.map((d, i) => {
            const has = d.plan || d.events?.length || d.routeIds?.length;
            return (
              <TouchableOpacity key={d.id} onPress={() => selectDay(d.id)} style={[st.cell, d.id === day?.id && st.sel]}>
                <Text style={[st.num, d.id === day?.id && { color: '#fff' }]}>{d.number}</Text>
                {dateOf(i) && <Text style={[st.small, d.id === day?.id && { color: '#fff' }]}>{dateOf(i).slice(5)}</Text>}
                {has ? <View style={st.dot} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn small title="+ Añadir día" style={{ flex: 1 }} onPress={addDay} />
          {day && <Btn small title="− Quitar día" kind="danger" style={{ flex: 1 }} onPress={removeDay} />}
        </View>
      </Card>

      {day && (
        <Card>
          <H>Día {day.number}{dateOf(idx) ? ` · ${formatDate(dateOf(idx))}` : ''}</H>
          <Field label="Plan del día" multiline value={planText} onChangeText={(v) => { dirtyRef.current = true; setPlanText(v); }} onBlur={() => { if (dirtyRef.current) savePlan(); }} placeholder="Visita al centro, comida en..." />
          <Btn small title="Guardar plan" kind="outline" onPress={savePlan} />

          <Text style={st.sub}>Eventos</Text>
          {(day.events || []).map((e) => (
            <View key={e.id} style={st.event}>
              <Text style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{e.time || '--:--'}</Text>  {e.title}{e.place ? ` · ${e.place}` : ''}</Text>
              <Text style={{ color: colors.danger, padding: 4 }} onPress={() => patchDay({ events: (day.events || []).filter((x) => x.id !== e.id) })}>✕</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}><Field placeholder="Evento" value={ev.title} onChangeText={(v) => setEv({ ...ev, title: v })} /></View>
            <View style={{ flex: 1 }}><Field placeholder="HH:MM" keyboardType="numbers-and-punctuation" maxLength={5} value={ev.time} onChangeText={(v) => setEv({ ...ev, time: v })} /></View>
          </View>
          <Field placeholder="Lugar (opcional)" value={ev.place} onChangeText={(v) => setEv({ ...ev, place: v })} />
          <Btn small title="Agendar evento" kind="outline" onPress={addEvent} />

          <Text style={st.sub}>Rutas del día</Text>
          {(trip.routes || []).length === 0 ? <Muted>Añade rutas en la pestaña "Ruta".</Muted> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {trip.routes.map((r) => <Chip key={r.id} title={r.name || `${r.origin} → ${r.destination}`} active={day.routeIds?.includes(r.id)} onPress={() => toggleRoute(r.id)} />)}
            </View>
          )}
          {(trip.routes || []).filter((r) => day.routeIds?.includes(r.id)).map((r) => (
            <View key={r.id} style={{ marginTop: 4 }}>
              <Muted>{r.time || ''} {r.origin} → {r.destination} · {(r.transports || []).join(', ')} {r.lines ? `(${r.lines})` : ''}</Muted>
              <LinkText url={googleMapsRouteUrl(r.origin, r.destination, r.stops, r.mode)}>Google Maps</LinkText>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 },
  cell: { width: '13%', margin: '0.6%', aspectRatio: 1, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  sel: { backgroundColor: colors.primary },
  num: { fontWeight: '700', color: colors.text },
  small: { fontSize: 9, color: colors.muted },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ok, marginTop: 2 },
  sub: { fontWeight: '700', marginTop: 10, marginBottom: 4 },
  event: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 6, padding: 8, marginBottom: 4 },
});
