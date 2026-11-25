import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, H, Field, Btn, Chip, Row, Label, Muted, confirm, notify , Text, DateField, useTheme } from '../components/ui';
import { uid } from '../store';
import { money, num, fmtDMY } from '../utils';

export const CATEGORIES = [
  ['vuelo', 'Coste vuelo', '✈️'],
  ['transporte', 'Costes de transporte', '🚆'],
  ['comida', 'Coste de comida', '🍽️'],
  ['hoteles', 'Coste de hoteles', '🏨'],
  ['entradas', 'Coste de entradas', '🎟️'],
  ['otros', 'Otros costes', '🧾'],
];

// Selector de quién pagó y para quién (gasto compartido con el grupo)
function SharePicker({ members, value, onChange }) {
  return (
    <View>
      <Label>Pagado por</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {members.map((m) => <Chip key={m.id} title={m.name} active={value.paidBy === m.id} onPress={() => onChange({ ...value, paidBy: m.id })} />)}
      </View>
      <Label>Para quién (vacío = todos)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {members.map((m) => {
          const on = value.participants.includes(m.id);
          return <Chip key={m.id} title={m.name} active={on} onPress={() => onChange({ ...value, participants: on ? value.participants.filter((x) => x !== m.id) : [...value.participants, m.id] })} />;
        })}
      </View>
    </View>
  );
}

export default function ExpensesScreen({ trip, update }) {
  const { colors } = useTheme();
  const expenses = trip.expenses || [];
  const group = { members: [], expenses: [], ...(trip.group || {}) };
  const members = group.members;
  const [form, setForm] = useState({ category: 'vuelo', concept: '', amount: '', date: '' });
  const [share, setShare] = useState({ on: false, paidBy: null, participants: [] });
  const [sharing, setSharing] = useState(null); // { id, paidBy, participants } al compartir un gasto existente
  const [filter, setFilter] = useState(null);
  const nameOf = (id) => members.find((m) => m.id === id)?.name || '?';
  // Gasto de grupo vinculado a un gasto del viaje (si el gasto de grupo se borra desde Grupo, deja de estar vinculado)
  const linkOf = (e) => (e.groupId ? group.expenses.find((g) => g.id === e.groupId) : null);
  const groupExpense = (e, id, s) => {
    const ids = members.map((m) => m.id);
    const chosen = s.participants.filter((x) => ids.includes(x));
    return { id, concept: e.concept || (CATEGORIES.find((c) => c[0] === e.category)?.[1] ?? 'Gasto'), amount: e.amount, paidBy: s.paidBy, participants: chosen.length ? chosen : ids, date: e.date || '', expenseId: e.id };
  };

  const add = () => {
    const amount = Math.round(num(form.amount) * 100) / 100;
    if (!(amount > 0)) return notify('Importe no válido', 'Introduce un importe mayor que 0.');
    const date = form.date.trim();
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T12:00:00`)))) return notify('Fecha no válida', 'Elige la fecha en el calendario.');
    const wantsShare = share.on && members.length > 1;
    if (wantsShare && !members.some((m) => m.id === share.paidBy)) return notify('Elige quién ha pagado', 'Para compartir el gasto con el grupo indica quién lo pagó.');
    const exp = { ...form, concept: form.concept.trim(), date, amount, id: uid() };
    if (wantsShare) {
      const gid = uid();
      exp.groupId = gid;
      update({ expenses: [...expenses, exp], group: { ...group, expenses: [...group.expenses, groupExpense(exp, gid, share)] } });
    } else update({ expenses: [...expenses, exp] });
    setForm({ ...form, concept: '', amount: '' });
    setShare({ ...share, on: false, participants: [] });
  };
  const confirmShare = (e) => {
    if (!members.some((m) => m.id === sharing.paidBy)) return notify('Elige quién ha pagado');
    const gid = uid();
    update({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, groupId: gid } : x)), group: { ...group, expenses: [...group.expenses, groupExpense(e, gid, sharing)] } });
    setSharing(null);
  };
  const unshare = (e) => update({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, groupId: undefined } : x)), group: { ...group, expenses: group.expenses.filter((g) => g.id !== e.groupId) } });
  const remove = (e) => confirm(linkOf(e) ? '¿Eliminar gasto? También se quitará del gasto en grupo.' : '¿Eliminar gasto?', () => update({ expenses: expenses.filter((x) => x.id !== e.id), ...(linkOf(e) ? { group: { ...group, expenses: group.expenses.filter((g) => g.id !== e.groupId) } } : {}) }));
  // Importa (o actualiza) un gasto automático conservando su vínculo con el grupo
  const importCost = (flag, category, concept, amount) => {
    const old = expenses.find((e) => e[flag]);
    const next = { id: uid(), category, concept, amount, [flag]: true, ...(old?.groupId ? { groupId: old.groupId } : {}) };
    const patch = { expenses: [...expenses.filter((e) => !e[flag]), next] };
    if (old && linkOf(old)) patch.group = { ...group, expenses: group.expenses.map((g) => (g.id === old.groupId ? { ...g, amount, expenseId: next.id } : g)) };
    update(patch);
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
        {routesCost > 0 && <Btn small kind="outline" title={`${expenses.some((e) => e.fromRoutes) ? 'Actualizar' : 'Importar'} coste de rutas en Transporte`} onPress={() => importCost('fromRoutes', 'transporte', 'Rutas del viaje', routesCost)} />}
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
        <Label>Gasto en grupo</Label>
        {members.length > 1 ? (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip title="👥 Compartir con el grupo" active={share.on} onPress={() => setShare({ ...share, on: !share.on })} />
            </View>
            {share.on && <SharePicker members={members} value={share} onChange={(v) => setShare({ ...share, ...v })} />}
            {share.on && <Muted>Se añadirá también en la pestaña Grupo y quedarán vinculados.</Muted>}
          </View>
        ) : <Muted>Añade al menos 2 participantes en la pestaña Grupo para poder compartir gastos.</Muted>}
        <Btn title="Añadir" onPress={add} />
      </Card>

      <Card>
        <H>Movimientos</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip title="Todos" active={!filter} onPress={() => setFilter(null)} />
          {CATEGORIES.map(([k, , icon]) => <Chip key={k} title={icon} active={filter === k} onPress={() => setFilter(k)} />)}
        </View>
        {expenses.filter((e) => !filter || catKey(e) === filter).map((e) => {
          const link = linkOf(e);
          return (
            <View key={e.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1 }}>{CATEGORIES.find((c) => c[0] === catKey(e))?.[2]} {e.concept || '-'} <Text style={{ color: colors.muted }}>{fmtDMY(e.date)}</Text></Text>
                <Text style={{ fontWeight: '700' }}>{money(e.amount)}</Text>
                <Text style={{ color: colors.danger, paddingLeft: 12 }} onPress={() => remove(e)}>✕</Text>
              </View>
              {link ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Muted style={{ flex: 1 }}>👥 En grupo · pagó {nameOf(link.paidBy)} · para {(link.participants || []).map(nameOf).join(', ')}</Muted>
                  <Text style={{ color: colors.primary, paddingLeft: 8 }} onPress={() => confirm('¿Quitar este gasto del grupo? Seguirá en Gastos.', () => unshare(e))}>Quitar</Text>
                </View>
              ) : members.length > 1 && sharing?.id !== e.id ? (
                <Text style={{ color: colors.primary }} onPress={() => setSharing({ id: e.id, paidBy: null, participants: [] })}>👥 Compartir con el grupo</Text>
              ) : null}
              {!link && sharing?.id === e.id && (
                <View>
                  <SharePicker members={members} value={sharing} onChange={(v) => setSharing({ ...sharing, ...v })} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn small title="Compartir" onPress={() => confirmShare(e)} />
                    <Btn small kind="outline" title="Cancelar" onPress={() => setSharing(null)} />
                  </View>
                </View>
              )}
            </View>
          );
        })}
        {!expenses.length && <Muted>Sin gastos todavía.</Muted>}
      </Card>
    </ScrollView>
  );
}
