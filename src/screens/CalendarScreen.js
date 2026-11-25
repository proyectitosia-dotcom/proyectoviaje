import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card, H, Field, Btn, Chip, Label, Muted, LinkText, colors, confirm } from '../components/ui';
import { uid } from '../store';
import { addDays, formatDate, googleMapsRouteUrl } from '../utils';

export default function CalendarScreen({ trip, update }) {
  const days = trip.days || [];
  const [selId, setSelId] = useState(days[0]?.id);
  const [ev, setEv] = useState({ title: '', time: '', place: '' });
  const [startDate, setStartDate] = useState(trip.startDate || '');
  const idx = Math.max(0, days.findIndex((d) => d.id === selId));
  const day = days[idx];
  const planRef = useRef(null);
  useEffect(() => { planRef.current = null; }, [selId]);
  const dateOf = (i) => (trip.startDate ? addDays(trip.startDate, i) : null);

  const saveDays = (list) => update({ days: list.map((d, i) => ({ ...d, number: i + 1 })) });
  const patchDay = (patch) => saveDays(days.map((d) => (d.id === day.id ? { ...d, ...patch } : d)));
  const addDay = () => { const d = { id: uid(), number: days.length + 1, plan: '', routeIds: [], events: [] }; saveDays([...days, d]); setSelId(d.id); };
  const removeDay = () => confirm(`¿Quitar el día ${day.number}?`, () => { const list = days.filter((d) => d.id !== day.id); saveDays(list); setSelId(list[Math.max(0, idx - 1)]?.id); });
  const addEvent = () => {
    if (!ev.title) return;
    const events = [...(day.events || []), { ...ev, id: uid() }].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    patchDay({ events });
    setEv({ title: '', time: '', place: '' });
  };
  const toggleRoute = (rid) => patchDay({ routeIds: day.routeIds?.includes(rid) ? day.routeIds.filter((x) => x !== rid) : [...(day.routeIds || []), rid] });

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Label>Fecha de inicio del viaje (día 1)</Label>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Field value={startDate} onChangeText={setStartDate} placeholder="AAAA-MM-DD" /></View>
          <Btn small title="Guardar" onPress={() => update({ startDate })} />
        </View>
        <View style={st.grid}>
          {days.map((d, i) => {
            const has = d.plan || d.events?.length || d.routeIds?.length;
            return (
              <TouchableOpacity key={d.id} onPress={() => setSelId(d.id)} style={[st.cell, d.id === day?.id && st.sel]}>
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
          <Field key={day.id + (day.plan || '')} label="Plan del día" multiline defaultValue={day.plan} onChangeText={(v) => { planRef.current = v; }} placeholder="Visita al centro, comida en..." />
          <Btn small title="Guardar plan" kind="outline" onPress={() => planRef.current !== null && patchDay({ plan: planRef.current })} />

          <Text style={st.sub}>Eventos</Text>
          {(day.events || []).map((e) => (
            <View key={e.id} style={st.event}>
              <Text style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{e.time || '--:--'}</Text>  {e.title}{e.place ? ` · ${e.place}` : ''}</Text>
              <Text style={{ color: colors.danger, padding: 4 }} onPress={() => patchDay({ events: day.events.filter((x) => x.id !== e.id) })}>✕</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}><Field placeholder="Evento" value={ev.title} onChangeText={(v) => setEv({ ...ev, title: v })} /></View>
            <View style={{ flex: 1 }}><Field placeholder="HH:MM" value={ev.time} onChangeText={(v) => setEv({ ...ev, time: v })} /></View>
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
