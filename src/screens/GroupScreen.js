import React, { useState } from 'react';
import { ScrollView, View, Modal } from 'react-native';
import { Card, H, Field, Btn, Chip, Muted, confirm, notify, Text, useTheme } from '../components/ui';
import { uid } from '../store';
import { money, num, settleUp, todayISO, fmtDMY } from '../utils';

export default function GroupScreen({ trip, update }) {
  const { colors } = useTheme();
  const group = trip.group || { members: [], expenses: [] };
  const { members, expenses } = group;
  const [name, setName] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const save = (patch) => update({ group: { ...group, ...patch } });
  // Al quitar un gasto del historial del grupo, también desaparece el gasto personal vinculado (el de quien lo hizo)
  const removeGroupExpense = (e) => update({
    group: { ...group, expenses: expenses.filter((x) => x.id !== e.id) },
    ...(e.settlement ? {} : { expenses: (trip.expenses || []).filter((x) => x.groupId !== e.id) }),
  });
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
    });
  };
  const settle = (t) => {
    const amount = r2(t.amount);
    if (!(amount > 0)) return;
    // Un pago es un gasto "de A para B": sube el saldo de quien paga y baja el de quien cobra
    save({ expenses: [...expenses, { id: uid(), settlement: true, concept: 'Pago de deuda', amount, paidBy: t.from, participants: [t.to], date: todayISO() }] });
  };
  const { balances, transfers } = settleUp(members, expenses);
  // Total gastado del grupo: suma de los gastos en grupo y se le restan las deudas que se van pagando
  const spent = r2(expenses.filter((e) => !e.settlement).reduce((a, e) => a + num(e.amount), 0));
  const paid = r2(expenses.filter((e) => e.settlement).reduce((a, e) => a + num(e.amount), 0));
  const total = r2(spent - paid);

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

      <Card>
        <H>Saldos</H>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primary }}>{money(total)}</Text>
        <Muted>Total gastado por el grupo</Muted>
        <Muted>Gastos en grupo: {money(spent)} · Deudas pagadas: − {money(paid)}</Muted>
        {members.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
            <Text>{m.name}</Text>
            <Text style={{ fontWeight: '700', color: r2(balances[m.id]) >= 0 ? colors.ok : colors.danger }}>{r2(balances[m.id]) >= 0 ? '+' : ''}{money(r2(balances[m.id]))}</Text>
          </View>
        ))}
        <View style={{ marginTop: 10 }}>
          {transfers.length ? <Btn title="Pagar" onPress={() => setPayOpen(true)} /> : <Muted>Todo cuadrado ✅</Muted>}
        </View>
      </Card>

      <Card>
        <H>Historial</H>
        {expenses.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
            <View style={{ flex: 1 }}>
              {e.settlement ? (
                <>
                  <Text>💸 {nameOf(e.paidBy)} pagó {money(e.amount)} a {nameOf((e.participants || [])[0])}</Text>
                  <Muted>Deuda saldada{e.date ? ` · ${fmtDMY(e.date)}` : ''}</Muted>
                </>
              ) : (
                <>
                  <Text>{e.concept || 'Gasto'} · {money(e.amount)}</Text>
                  <Muted>Pagó {nameOf(e.paidBy)} · para {e.shares ? Object.entries(e.shares).map(([id, v]) => `${nameOf(id)} ${money(r2(v))}`).join(', ') : (e.participants || []).map(nameOf).join(', ')}</Muted>
                </>
              )}
            </View>
            <Text style={{ color: colors.danger, padding: 6 }} onPress={() => confirm(e.settlement ? '¿Deshacer este pago?' : '¿Eliminar gasto?', () => removeGroupExpense(e))}>✕</Text>
          </View>
        ))}
        {!expenses.length && <Muted>Sin movimientos.</Muted>}
      </Card>

      <Modal visible={payOpen} transparent animationType="fade" onRequestClose={() => setPayOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, maxHeight: '85%' }}>
            <H>Pagar deudas</H>
            <ScrollView>
              {transfers.length ? transfers.map((t) => (
                <View key={`${t.from}-${t.to}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
                  <Text style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>{nameOf(t.from)}</Text> debe {money(r2(t.amount))} a <Text style={{ fontWeight: '700' }}>{nameOf(t.to)}</Text>
                  </Text>
                  <Btn small title="Pagado" onPress={() => settle(t)} />
                </View>
              )) : <Muted>Todo cuadrado ✅</Muted>}
            </ScrollView>
            <View style={{ marginTop: 12 }}><Btn kind="outline" title="Cerrar" onPress={() => setPayOpen(false)} /></View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
