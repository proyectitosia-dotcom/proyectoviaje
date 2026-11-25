import React, { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, H, Field, Btn, Chip, Label, Muted, colors, confirm } from '../components/ui';
import { uid } from '../store';
import { money, num, settleUp } from '../utils';

export default function GroupScreen({ trip, update }) {
  const group = trip.group || { members: [], expenses: [] };
  const { members, expenses } = group;
  const [name, setName] = useState('');
  const [form, setForm] = useState({ concept: '', amount: '', paidBy: null, participants: [] });
  const save = (patch) => update({ group: { ...group, ...patch } });
  const nameOf = (id) => members.find((m) => m.id === id)?.name || '?';

  const addMember = () => {
    if (!name.trim()) return;
    save({ members: [...members, { id: uid(), name: name.trim() }] });
    setName('');
  };
  const removeMember = (m) => {
    if (expenses.some((e) => e.paidBy === m.id || e.participants.includes(m.id))) return confirm(`${m.name} tiene gastos asociados. Elimina esos gastos primero.`, () => {});
    save({ members: members.filter((x) => x.id !== m.id) });
  };
  const addExpense = () => {
    const participants = form.participants.length ? form.participants : members.map((m) => m.id);
    if (!form.paidBy || !num(form.amount)) return;
    save({ expenses: [...expenses, { ...form, participants, amount: num(form.amount), id: uid() }] });
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
            <Text style={{ fontWeight: '700', color: balances[m.id] >= 0 ? colors.ok : colors.danger }}>{balances[m.id] >= 0 ? '+' : ''}{money(balances[m.id])}</Text>
          </View>
        ))}
        <Text style={{ fontWeight: '700', marginTop: 10 }}>Cómo cuadrar las cuentas</Text>
        {transfers.length ? transfers.map((t, i) => (
          <Text key={i} style={{ paddingVertical: 3 }}>💸 <Text style={{ fontWeight: '700' }}>{nameOf(t.from)}</Text> paga {money(t.amount)} a <Text style={{ fontWeight: '700' }}>{nameOf(t.to)}</Text></Text>
        )) : <Muted>Todo cuadrado ✅</Muted>}
      </Card>

      <Card>
        <H>Historial</H>
        {expenses.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
            <View style={{ flex: 1 }}>
              <Text>{e.concept || 'Gasto'} · {money(e.amount)}</Text>
              <Muted>Pagó {nameOf(e.paidBy)} · para {e.participants.map(nameOf).join(', ')}</Muted>
            </View>
            <Text style={{ color: colors.danger, padding: 6 }} onPress={() => confirm('¿Eliminar gasto?', () => save({ expenses: expenses.filter((x) => x.id !== e.id) }))}>✕</Text>
          </View>
        ))}
        {!expenses.length && <Muted>Sin gastos compartidos.</Muted>}
      </Card>
    </ScrollView>
  );
}
