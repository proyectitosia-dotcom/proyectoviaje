import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, H, Field, Btn, Chip, Row, Muted, confirm, notify , Text, DateField, useTheme } from '../components/ui';
import { uid } from '../store';
import { money, num, fmtDMY } from '../utils';

export const CATEGORIES = [
  ['vuelo', 'Coste vuelo', '✈️'],
  ['transporte', 'Costes de transporte', '🚆'],
  ['comida', 'Coste de comida', '🍽️'],
  ['entradas', 'Coste de entradas', '🎟️'],
  ['otros', 'Otros costes', '🧾'],
];

export default function ExpensesScreen({ trip, update }) {
  const { colors } = useTheme();
  const expenses = trip.expenses || [];
  const [form, setForm] = useState({ category: 'vuelo', concept: '', amount: '', date: '' });
  const [filter, setFilter] = useState(null);

  const add = () => {
    const amount = Math.round(num(form.amount) * 100) / 100;
    if (!(amount > 0)) return notify('Importe no válido', 'Introduce un importe mayor que 0.');
    const date = form.date.trim();
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T12:00:00`)))) return notify('Fecha no válida', 'Elige la fecha en el calendario.');
    update({ expenses: [...expenses, { ...form, concept: form.concept.trim(), date, amount, id: uid() }] });
    setForm({ ...form, concept: '', amount: '' });
  };
  const catKey = (e) => (CATEGORIES.some(([k]) => k === e.category) ? e.category : 'otros');
  const byCat = Object.fromEntries(CATEGORIES.map(([k]) => [k, expenses.filter((e) => catKey(e) === k).reduce((a, e) => a + num(e.amount), 0)]));
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  const routesCost = (trip.routes || []).reduce((a, r) => a + num(r.cost), 0);
  const hotelsCost = (trip.hotels || []).reduce((a, h) => {
    const diff = h.checkIn && h.checkOut ? Math.round((new Date(`${h.checkOut}T12:00:00`) - new Date(`${h.checkIn}T12:00:00`)) / 864e5) : 0;
    const n = Number.isFinite(diff) ? Math.max(0, diff) : 0;
    return a + num(h.pricePerNight) * Math.max(1, num(h.rooms)) * n;
  }, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <H>Resumen de gastos</H>
        {CATEGORIES.map(([k, label, icon]) => (
          <View key={k}>
            <Row label={`${icon} ${label}${total > 0 ? ` (${Math.round((byCat[k] / total) * 100)}%)` : ''}`} value={money(byCat[k])} />
            <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, marginBottom: 4 }}>
              <View style={{ height: 6, width: `${total > 0 ? Math.min(100, Math.max(0, (byCat[k] / total) * 100)) : 0}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
            </View>
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: 6, paddingTop: 6 }}>
          <Row label="TOTAL" value={money(total)} />
        </View>
        <Muted style={{ marginTop: 6 }}>Referencia: rutas registradas {money(routesCost)} · hoteles {money(hotelsCost)}</Muted>
        {routesCost > 0 && <Btn small kind="outline" title={`${expenses.some((e) => e.fromRoutes) ? 'Actualizar' : 'Importar'} coste de rutas en Transporte`} onPress={() => update({ expenses: [...expenses.filter((e) => !e.fromRoutes), { id: uid(), category: 'transporte', concept: 'Rutas del viaje', amount: routesCost, fromRoutes: true }] })} />}
        {hotelsCost > 0 && <Btn small kind="outline" title={`${expenses.some((e) => e.fromHotels) ? 'Actualizar' : 'Importar'} coste de hoteles en Otros`} onPress={() => update({ expenses: [...expenses.filter((e) => !e.fromHotels), { id: uid(), category: 'otros', concept: 'Alojamiento', amount: hotelsCost, fromHotels: true }] })} />}
      </Card>

      <Card>
        <H>Añadir gasto</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {CATEGORIES.map(([k, label, icon]) => <Chip key={k} title={`${icon} ${label.replace(/^Costes? (de )?/, '').replace(/^./, (c) => c.toUpperCase())}`} active={form.category === k} onPress={() => setForm({ ...form, category: k })} />)}
        </View>
        <Field label="Concepto" value={form.concept} onChangeText={(v) => setForm({ ...form, concept: v })} placeholder="Ej. Entradas Coliseo" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Importe (€)" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><DateField label="Fecha" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></View>
        </View>
        <Btn title="Añadir" onPress={add} />
      </Card>

      <Card>
        <H>Movimientos</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip title="Todos" active={!filter} onPress={() => setFilter(null)} />
          {CATEGORIES.map(([k, , icon]) => <Chip key={k} title={icon} active={filter === k} onPress={() => setFilter(k)} />)}
        </View>
        {expenses.filter((e) => !filter || catKey(e) === filter).map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
            <Text style={{ flex: 1 }}>{CATEGORIES.find((c) => c[0] === catKey(e))?.[2]} {e.concept || '-'} <Text style={{ color: colors.muted }}>{fmtDMY(e.date)}</Text></Text>
            <Text style={{ fontWeight: '700' }}>{money(e.amount)}</Text>
            <Text style={{ color: colors.danger, paddingLeft: 12 }} onPress={() => confirm('¿Eliminar gasto?', () => update({ expenses: expenses.filter((x) => x.id !== e.id) }))}>✕</Text>
          </View>
        ))}
        {!expenses.length && <Muted>Sin gastos todavía.</Muted>}
      </Card>
    </ScrollView>
  );
}
