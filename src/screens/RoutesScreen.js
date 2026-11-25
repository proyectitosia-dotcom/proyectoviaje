import React, { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H, Field, Btn, Row, LinkText, Chip, Label, Muted, confirm } from '../components/ui';
import { uid } from '../store';
import { money, num, googleMapsRouteUrl, formatDate } from '../utils';

const TRANSPORTS = ['Avión', 'Tren', 'Autobús', 'Metro', 'Tranvía', 'Coche', 'Taxi', 'Barco', 'A pie', 'Bici'];
const MODES = [['transit', 'Transporte público'], ['driving', 'Coche'], ['walking', 'A pie'], ['bicycling', 'Bici']];
const empty = { name: '', origin: '', destination: '', stops: '', date: '', time: '', duration: '', cost: '', transports: [], lines: '', mode: 'transit' };

export default function RoutesScreen({ trip, update }) {
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const routes = trip.routes || [];

  const save = () => {
    if (!form.origin || !form.destination) return;
    const r = { ...form, stops: form.stops.split(',').map((x) => x.trim()).filter(Boolean), cost: num(form.cost) };
    const list = form.id ? routes.map((x) => (x.id === form.id ? r : x)) : [...routes, { ...r, id: uid() }];
    list.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    update({ routes: list });
    setForm(null);
  };
  const edit = (r) => setForm({ ...r, stops: (r.stops || []).join(', '), cost: String(r.cost ?? '') });
  const remove = (r) => confirm('¿Eliminar esta ruta?', () => update({ routes: routes.filter((x) => x.id !== r.id) }));
  const total = routes.reduce((a, r) => a + num(r.cost), 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <H>Ruta general del viaje</H>
        <Row label="Trayectos" value={routes.length} />
        <Row label="Coste total transporte" value={money(total)} />
        {routes.length > 1 && (
          <LinkText url={googleMapsRouteUrl(routes[0].origin, routes[routes.length - 1].destination, routes.flatMap((r, i) => (i === 0 ? r.stops : [r.origin, ...r.stops])).slice(0, 9), 'driving')}>
            Ver ruta completa en Google Maps
          </LinkText>
        )}
        {!form && <Btn title="+ Añadir trayecto" onPress={() => setForm(empty)} />}
      </Card>

      {form && (
        <Card>
          <H>{form.id ? 'Editar trayecto' : 'Nuevo trayecto'}</H>
          <Field label="Nombre (opcional)" value={form.name} onChangeText={(v) => set('name', v)} placeholder="Ej. Madrid → París" />
          <Field label="Origen *" value={form.origin} onChangeText={(v) => set('origin', v)} placeholder="Estación de Atocha, Madrid" />
          <Field label="Paradas (separadas por comas)" value={form.stops} onChangeText={(v) => set('stops', v)} placeholder="Zaragoza, Barcelona" />
          <Field label="Destino *" value={form.destination} onChangeText={(v) => set('destination', v)} placeholder="Gare de Lyon, París" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Fecha (AAAA-MM-DD)" value={form.date} onChangeText={(v) => set('date', v)} placeholder="2026-07-01" /></View>
            <View style={{ flex: 1 }}><Field label="Hora salida" value={form.time} onChangeText={(v) => set('time', v)} placeholder="08:30" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Duración" value={form.duration} onChangeText={(v) => set('duration', v)} placeholder="6h 30min" /></View>
            <View style={{ flex: 1 }}><Field label="Coste (€)" value={form.cost} onChangeText={(v) => set('cost', v)} keyboardType="decimal-pad" /></View>
          </View>
          <Label>Tipo de transporte</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TRANSPORTS.map((t) => (
              <Chip key={t} title={t} active={form.transports.includes(t)}
                onPress={() => set('transports', form.transports.includes(t) ? form.transports.filter((x) => x !== t) : [...form.transports, t])} />
            ))}
          </View>
          <Field label="Líneas utilizadas" value={form.lines} onChangeText={(v) => set('lines', v)} placeholder="AVE 03071, Metro L1, Bus 27" />
          <Label>Modo para Google Maps</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MODES.map(([k, l]) => <Chip key={k} title={l} active={form.mode === k} onPress={() => set('mode', k)} />)}
          </View>
          <Btn title="Guardar" onPress={save} />
          <Btn title="Cancelar" kind="outline" onPress={() => setForm(null)} />
        </Card>
      )}

      {routes.map((r, i) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{i + 1}. {r.name || `${r.origin} → ${r.destination}`}</Text>
          <Muted>{r.date ? formatDate(r.date) : 'Sin fecha'} {r.time ? `· ${r.time}` : ''}</Muted>
          <Row label="Origen" value={r.origin} />
          {(r.stops || []).length > 0 && <Row label="Paradas" value={r.stops.join(' → ')} />}
          <Row label="Destino" value={r.destination} />
          <Row label="Duración" value={r.duration || '-'} />
          <Row label="Coste" value={money(r.cost)} />
          <Row label="Transporte" value={(r.transports || []).join(', ') || '-'} />
          <Row label="Líneas" value={r.lines || '-'} />
          <LinkText url={googleMapsRouteUrl(r.origin, r.destination, r.stops, r.mode)}>Abrir ruta en Google Maps</LinkText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small title="Editar" kind="outline" onPress={() => edit(r)} style={{ flex: 1 }} />
            <Btn small title="Eliminar" kind="danger" onPress={() => remove(r)} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
