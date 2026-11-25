import React, { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H, Field, Btn, Chip, Label, Muted, colors, confirm, notify } from '../components/ui';
import { uid } from '../store';
import { money, num, settleUp } from '../utils';

export default function GroupScreen({ trip, update }) {
  const group = trip.group || { members: [], expenses: [] };
  const { members, expenses } = group;
  const [name, setName] = useState('');
  const [form, setForm] = useState({ concept: '', amount: '', paidBy: null, participants: [] });
  const save = (patch) => update({ group: { ...group, ...patch } });
  const nameOf = (id) => members.find((m) => m.id === id)?.name || '?';

  const r2 = (x) => { const v = Math.round((Number(x) || 0) * 100) / 100; return v === 0 ? 0 : v; };
  const addMember = () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (members.some((m) => m.name.trim().toLowerCase() === n.toLowerCase())) return notify(`Ya existe un participante llamado "${n}"`);
    save({ members: [...members, { id: uid(), name: n }] });
    setName('');
  };
  const removeMember = (m) => {
    if (expenses.some((e) => e.paidBy === m.id || (e.participants || []).includes(m.id))) return notify(`${m.name} tiene gastos asociados. Elimina esos gastos primero.`);
    confirm(`¿Eliminar a ${m.name}?`, () => {
      save({ members: members.filter((x) => x.id !== m.id) });
      setForm((f) => ({ ...f, paidBy: f.paidBy === m.id ? null : f.paidBy, participants: f.participants.filter((x) => x !== m.id) }));
    });
  };
  const addExpense = () => {
    const ids = members.map((m) => m.id);
    const chosen = form.participants.filter((x) => ids.includes(x));
    const participants = chosen.length ? chosen : ids;
    const amount = r2(num(form.amount));
    if (!(amount > 0)) return notify('Indica un importe mayor que 0');
    if (!form.paidBy || !ids.includes(form.paidBy)) return notify('Elige quién ha pagado');
    save({ expenses: [...expenses, { ...form, concept: form.concept.trim(), participants, amount, id: uid() }] });
    setForm({ concept: '', amount: '', paidBy: form.paidBy, participants: [] });
  };
  const { balances, transfers } = settleUp(members, expenses);
  const total = expenses.reduce((a, e) => a + num(e.amount), 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <H>Participantes</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {members.map((m) => <Chip key={m.id} title={`${m.name} ✕`} onPress={() => removeMember(m)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Field value={name} onChangeText={setName} placeholder="Nombre" onSubmitEditing={addMember} /></View>
          <Btn small title="Añadir" onPress={addMember} />
        </View>
      </Card>

      {members.length > 1 && (
        <Card>
          <H>Nuevo gasto compartido</H>
          <Field label="Concepto" value={form.concept} onChangeText={(v) => setForm({ ...form, concept: v })} placeholder="Cena" />
          <Field label="Importe (€)" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />
          <Label>Pagado por</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {members.map((m) => <Chip key={m.id} title={m.name} active={form.paidBy === m.id} onPress={() => setForm({ ...form, paidBy: m.id })} />)}
          </View>
          <Label>Para quién (vacío = todos)</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {members.map((m) => {
              const on = form.participants.includes(m.id);
              return <Chip key={m.id} title={m.name} active={on} onPress={() => setForm({ ...form, participants: on ? form.participants.filter((x) => x !== m.id) : [...form.participants, m.id] })} />;
            })}
          </View>
          <Btn title="Añadir gasto" onPress={addExpense} />
        </Card>
      )}

      <Card>
        <H>Saldos</H>
        <Muted>Total gastado por el grupo: {money(total)}</Muted>
        {members.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
            <Text>{m.name}</Text>
            <Text style={{ fontWeight: '700', color: r2(balances[m.id]) >= 0 ? colors.ok : colors.danger }}>{r2(balances[m.id]) >= 0 ? '+' : ''}{money(r2(balances[m.id]))}</Text>
          </View>
        ))}
        <Text style={{ fontWeight: '700', marginTop: 10 }}>Cómo cuadrar las cuentas</Text>
        {transfers.length ? transfers.map((t, i) => (
          <Text key={i} style={{ paddingVertical: 3 }}>💸 <Text style={{ fontWeight: '700' }}>{nameOf(t.from)}</Text> paga {money(r2(t.amount))} a <Text style={{ fontWeight: '700' }}>{nameOf(t.to)}</Text></Text>
        )) : <Muted>Todo cuadrado ✅</Muted>}
      </Card>

      <Card>
        <H>Historial</H>
        {expenses.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
            <View style={{ flex: 1 }}>
              <Text>{e.concept || 'Gasto'} · {money(e.amount)}</Text>
              <Muted>Pagó {nameOf(e.paidBy)} · para {(e.participants || []).map(nameOf).join(', ')}</Muted>
            </View>
            <Text style={{ color: colors.danger, padding: 6 }} onPress={() => confirm('¿Eliminar gasto?', () => save({ expenses: expenses.filter((x) => x.id !== e.id) }))}>✕</Text>
          </View>
        ))}
        {!expenses.length && <Muted>Sin gastos compartidos.</Muted>}
      </Card>
    </ScrollView>
  );
}
