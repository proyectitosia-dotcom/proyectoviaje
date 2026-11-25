import React, { useEffect, useState } from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { Card, H, Field, Btn, Chip, Row, Label, Muted, confirm, notify , Text, DateField, useTheme } from '../components/ui';
import { uid } from '../store';
import { money, num, fmtDMY } from '../utils';
import { useMe } from '../user';

export const CATEGORIES = [
  ['vuelo', 'Coste vuelo', '✈️'],
  ['transporte', 'Costes de transporte', '🚆'],
  ['comida', 'Coste de comida', '🍽️'],
  ['hoteles', 'Coste de hoteles', '🏨'],
  ['entradas', 'Coste de entradas', '🎟️'],
  ['otros', 'Otros costes', '🧾'],
];

// Divisas: los importes se guardan siempre en euros; el cambio (euros por 1 unidad) es editable y global al viaje
export const CURRENCIES = [['EUR', 'Euro'], ['USD', 'Dólar EE. UU.'], ['GBP', 'Libra esterlina'], ['JPY', 'Yen'], ['CHF', 'Franco suizo'], ['CAD', 'Dólar canadiense'], ['AUD', 'Dólar australiano'], ['MXN', 'Peso mexicano'], ['CNY', 'Yuan']];
export const DEFAULT_RATES = { USD: 0.92, GBP: 1.17, JPY: 0.0062, CHF: 1.05, CAD: 0.67, AUD: 0.6, MXN: 0.05, CNY: 0.13 };
const r2 = (x) => Math.round(x * 100) / 100;

// Cotizaciones online (euros por 1 unidad de cada divisa). Fuente principal: BCE vía Frankfurter; respaldo: open.er-api.com
async function fetchRates() {
  const codes = CURRENCIES.map(([c]) => c).filter((c) => c !== 'EUR');
  const get = async (url) => {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 8000);
    try { const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); } finally { clearTimeout(t); }
  };
  const sources = [
    [`https://api.frankfurter.app/latest?from=EUR&to=${codes.join(',')}`, (j) => j.rates],
    ['https://open.er-api.com/v6/latest/EUR', (j) => (j.result === 'success' ? j.rates : null)],
  ];
  for (const [url, pick] of sources) {
    try {
      const perEur = pick(await get(url));
      const out = {};
      for (const c of codes) { const v = Number(perEur && perEur[c]); if (v > 0) out[c] = Number((1 / v).toPrecision(6)); }
      if (Object.keys(out).length === codes.length) return { rates: out, source: url.includes('frankfurter') ? 'BCE' : 'open.er-api.com' };
    } catch (e) { /* prueba la siguiente fuente */ }
  }
  throw new Error('sin conexión con las fuentes de cambio');
}
const FX_MAX_AGE = 3600 * 1000; // los cambios se renuevan solos si tienen más de 1 hora

function CurrencyPicker({ value, onChange }) {
  return (
    <View>
      <Label>Divisa del importe</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CURRENCIES.map(([c]) => <Chip key={c} title={c} active={value === c} onPress={() => onChange(c)} />)}
      </View>
    </View>
  );
}

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
  const { me } = useMe();
  const expenses = trip.expenses || [];
  const group = { members: [], expenses: [], ...(trip.group || {}) };
  const members = group.members;
  const [form, setForm] = useState({ category: 'vuelo', concept: '', amount: '', date: '', currency: 'EUR' });
  const [gform, setGform] = useState({ category: 'comida', concept: '', amount: '', date: '', currency: 'EUR', paidBy: null, participants: [] });
  const [rateDraft, setRateDraft] = useState({});
  const fx = trip.fx || {};
  const rateOf = (c) => (c === 'EUR' ? 1 : num(fx[c]) > 0 ? num(fx[c]) : DEFAULT_RATES[c] || 1);
  // Importe escrito en la divisa elegida -> euros (con el importe original para mostrarlo)
  const convert = (text, cur) => { const orig = r2(num(text)); const rate = rateOf(cur); return { eur: r2(orig * rate), ...(cur !== 'EUR' ? { orig: { amount: orig, currency: cur, rate } } : {}) }; };
  const [fxStatus, setFxStatus] = useState('');
  const [fxOpen, setFxOpen] = useState(false);
  const refreshRates = async () => {
    setFxStatus('Actualizando cambios…');
    try {
      const { rates, source } = await fetchRates();
      await update({ fx: { ...fx, ...rates }, fxAt: Date.now() });
      setFxStatus(`Cambios actualizados (${source}) · ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) { setFxStatus('No se pudo actualizar online; se usan los últimos cambios guardados.'); }
  };
  // Automático: al abrir Gastos y al elegir una divisa, si los cambios tienen más de 1 hora se descargan solos
  const ensureFresh = () => { if (!trip.fxAt || Date.now() - trip.fxAt > FX_MAX_AGE) refreshRates(); };
  useEffect(() => { ensureFresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const commitRate = (c) => {
    if (rateDraft[c] === undefined) return;
    const v = num(rateDraft[c]);
    setRateDraft(({ [c]: _x, ...rest }) => rest);
    if (v > 0) update({ fx: { ...fx, [c]: v } });
  };
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
    const { eur: amount, orig } = convert(form.amount, form.currency);
    if (!(amount > 0)) return notify('Importe no válido', 'Introduce un importe mayor que 0.');
    const date = form.date.trim();
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T12:00:00`)))) return notify('Fecha no válida', 'Elige la fecha en el calendario.');
    update({ expenses: [...expenses, { category: form.category, concept: form.concept.trim(), date, amount, id: uid(), by: me.id, byName: me.name, ...(orig ? { orig } : {}) }] });
    setForm({ ...form, concept: '', amount: '' });
  };
  // Gasto en grupo: se guarda en Gastos y en Grupo, vinculados entre sí
  const addGroup = () => {
    const { eur: amount, orig } = convert(gform.amount, gform.currency);
    if (!(amount > 0)) return notify('Importe no válido', 'Introduce un importe mayor que 0.');
    const date = gform.date.trim();
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T12:00:00`)))) return notify('Fecha no válida', 'Elige la fecha en el calendario.');
    if (!members.some((m) => m.id === gform.paidBy)) return notify('Elige quién ha pagado');
    const gid = uid();
    const exp = { id: uid(), category: gform.category, concept: gform.concept.trim(), amount, date, groupId: gid, by: me.id, byName: me.name, ...(orig ? { orig } : {}) };
    update({ expenses: [...expenses, exp], group: { ...group, expenses: [...group.expenses, groupExpense(exp, gid, gform)] } });
    setGform({ ...gform, concept: '', amount: '', participants: [] });
  };
  const confirmShare = (e) => {
    if (!members.some((m) => m.id === sharing.paidBy)) return notify('Elige quién ha pagado');
    const gid = uid();
    update({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, groupId: gid } : x)), group: { ...group, expenses: [...group.expenses, groupExpense(e, gid, sharing)] } });
    setSharing(null);
  };
  const unshare = (e) => update({ expenses: expenses.map((x) => { if (x.id !== e.id) return x; const { groupId: _g, ...rest } = x; return rest; }), group: { ...group, expenses: group.expenses.filter((g) => g.id !== e.groupId) } });
  const canEdit = (e) => !e.by || e.by === me.id;
  const remove = (e) => !canEdit(e) ? notify('No puedes eliminarlo', `Este gasto lo añadió ${e.byName || 'otra persona'}; solo esa persona puede eliminarlo.`) : confirm(linkOf(e) ? '¿Eliminar gasto? También se quitará del gasto en grupo.' : '¿Eliminar gasto?', () => update({ expenses: expenses.filter((x) => x.id !== e.id), ...(linkOf(e) ? { group: { ...group, expenses: group.expenses.filter((g) => g.id !== e.groupId) } } : {}) }));
  // Importa (o actualiza) un gasto automático conservando su vínculo con el grupo
  const importCost = (flag, category, concept, amount) => {
    const old = expenses.find((e) => e[flag] && e.by === me.id);
    const next = { id: uid(), category, concept, amount, by: me.id, byName: me.name, [flag]: true, ...(old?.groupId ? { groupId: old.groupId } : {}) };
    const patch = { expenses: [...expenses.filter((e) => !(e[flag] && e.by === me.id)), next] };
    if (old && linkOf(old)) patch.group = { ...group, expenses: group.expenses.map((g) => (g.id === old.groupId ? { ...g, amount, expenseId: next.id } : g)) };
    update(patch);
  };
  const catLabel = (label) => label.replace(/^Costes? (de )?/, '').replace(/^./, (c) => c.toUpperCase());
  const sharedExpenses = expenses.filter((e) => linkOf(e));
  const sharedTotal = sharedExpenses.reduce((a, e) => a + num(e.amount), 0);
  const catKey = (e) => (CATEGORIES.some(([k]) => k === e.category) ? e.category : 'otros');
  // Total y resumen INDIVIDUALES: solo los gastos personales que he añadido yo (los gastos en grupo se ven entre todos en la pestaña Grupo)
  const mine = expenses.filter((e) => e.by === me.id && !linkOf(e));
  const byCat = Object.fromEntries(CATEGORIES.map(([k]) => [k, mine.filter((e) => catKey(e) === k).reduce((a, e) => a + num(e.amount), 0)]));
  const total = r2(Object.values(byCat).reduce((a, b) => a + b, 0));
  const routesCost = (trip.routes || []).reduce((a, r) => a + num(r.cost), 0);
  const hotelsCost = (trip.hotels || []).reduce((a, h) => {
    const diff = h.checkIn && h.checkOut ? Math.round((new Date(`${h.checkOut}T12:00:00`) - new Date(`${h.checkIn}T12:00:00`)) / 864e5) : 0;
    const n = Number.isFinite(diff) ? Math.max(0, diff) : 0;
    return a + num(h.pricePerNight) * Math.max(1, num(h.rooms)) * n;
  }, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <H>💰 Mi total gastado</H>
        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.primary, marginBottom: 6 }}>{money(total)}</Text>
        <Muted>Solo cuenta los gastos que has añadido tú. Los gastos en grupo se ven entre todos en la pestaña Grupo.</Muted>
      </Card>

      <Card>
        <H>Mi resumen de gastos</H>
        {CATEGORIES.map(([k, label, icon]) => (
          <View key={k}>
            <Row label={`${icon} ${label}${total > 0 ? ` (${Math.round((byCat[k] / total) * 100)}%)` : ''}`} value={money(byCat[k])} />
            <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, marginBottom: 4 }}>
              <View style={{ height: 6, width: `${total > 0 ? Math.min(100, Math.max(0, (byCat[k] / total) * 100)) : 0}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
            </View>
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: 6, paddingTop: 6 }}>
          <Row label="Total" value={money(total)} />
        </View>
        <Muted style={{ marginTop: 6 }}>Referencia: rutas registradas {money(routesCost)} · hoteles {money(hotelsCost)}</Muted>
        {routesCost > 0 && <Btn small kind="outline" title={`${expenses.some((e) => e.fromRoutes && e.by === me.id) ? 'Actualizar' : 'Importar'} coste de rutas en Transporte`} onPress={() => importCost('fromRoutes', 'transporte', 'Rutas del viaje', routesCost)} />}
      </Card>

      <Card>
        <TouchableOpacity onPress={() => setFxOpen(!fxOpen)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H>💱 Cambio de divisa</H>
          <Text style={{ color: colors.primary, fontWeight: '700', marginBottom: 8 }}>{fxOpen ? 'Cerrar ▲' : 'Abrir ▼'}</Text>
        </TouchableOpacity>
        {fxOpen && (
          <View>
          <Muted>Todos los importes se guardan y se suman en euros. Si pagas en otra divisa, elígela al añadir el gasto y se convierte con estos cambios (1 unidad = X €). Se actualizan solos con cotizaciones online (BCE). Si no hay conexión se usan los últimos guardados, que puedes ajustar a mano.</Muted>
          {CURRENCIES.filter(([c]) => c !== 'EUR').map(([c, name]) => (
            <View key={c} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
              <Text style={{ flex: 1 }}>1 {c} <Text style={{ color: colors.muted }}>{name}</Text> =</Text>
              <View style={{ width: 110 }}>
                <Field value={rateDraft[c] ?? String(rateOf(c))} keyboardType="decimal-pad" onChangeText={(v) => setRateDraft({ ...rateDraft, [c]: v })} onBlur={() => commitRate(c)} onSubmitEditing={() => commitRate(c)} />
              </View>
              <Text style={{ paddingLeft: 6, paddingBottom: 8 }}>€</Text>
            </View>
          ))}
          {!!fxStatus && <Muted>{fxStatus}</Muted>}
          {!fxStatus && !!trip.fxAt && <Muted>Última actualización online: {new Date(trip.fxAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Muted>}
          </View>
        )}
      </Card>

      <Card>
        <H>Añadir gasto</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {CATEGORIES.map(([k, label, icon]) => <Chip key={k} title={`${icon} ${catLabel(label)}`} active={form.category === k} onPress={() => setForm({ ...form, category: k })} />)}
        </View>
        <Field label="Concepto" value={form.concept} onChangeText={(v) => setForm({ ...form, concept: v })} placeholder="Ej. Entradas Coliseo" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Importe" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><DateField label="Fecha" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></View>
        </View>
        <CurrencyPicker value={form.currency} onChange={(c) => { setForm({ ...form, currency: c }); if (c !== 'EUR') ensureFresh(); }} />
        {form.currency !== 'EUR' && <Muted>≈ {money(convert(form.amount, form.currency).eur)} (1 {form.currency} = {rateOf(form.currency)} €)</Muted>}
        <Btn title="Añadir" onPress={add} />
      </Card>

      <Card>
        <H>Gastos en grupo</H>
        {members.length > 1 ? (
          <View>
            <Muted>Se guardan en Gastos y también en la pestaña Grupo (saldos y cuentas), quedando vinculados.</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {CATEGORIES.map(([k, label, icon]) => <Chip key={k} title={`${icon} ${catLabel(label)}`} active={gform.category === k} onPress={() => setGform({ ...gform, category: k })} />)}
            </View>
            <Field label="Concepto" value={gform.concept} onChangeText={(v) => setGform({ ...gform, concept: v })} placeholder="Ej. Cena" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Importe" value={gform.amount} onChangeText={(v) => setGform({ ...gform, amount: v })} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><DateField label="Fecha" value={gform.date} onChange={(v) => setGform({ ...gform, date: v })} /></View>
            </View>
            <CurrencyPicker value={gform.currency} onChange={(c) => { setGform({ ...gform, currency: c }); if (c !== 'EUR') ensureFresh(); }} />
            {gform.currency !== 'EUR' && <Muted>≈ {money(convert(gform.amount, gform.currency).eur)} (1 {gform.currency} = {rateOf(gform.currency)} €)</Muted>}
            <SharePicker members={members} value={gform} onChange={(v) => setGform({ ...gform, ...v })} />
            <Btn title="Añadir gasto en grupo" onPress={addGroup} />
          </View>
        ) : <Muted>Añade al menos 2 participantes en la pestaña Grupo para poder registrar gastos en grupo.</Muted>}
        {sharedExpenses.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Row label="Total en grupo" value={money(sharedTotal)} />
            {sharedExpenses.map((e) => {
              const link = linkOf(e);
              return (
                <View key={e.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1 }}>{CATEGORIES.find((c) => c[0] === catKey(e))?.[2]} {e.concept || '-'} <Text style={{ color: colors.muted }}>{fmtDMY(e.date)}{e.orig ? ` · ${e.orig.amount} ${e.orig.currency}` : ''}{e.byName ? ` · ${e.byName}` : ''}</Text></Text>
                    <Text style={{ fontWeight: '700' }}>{money(e.amount)}</Text>
                    <Text style={{ color: colors.danger, paddingLeft: 12 }} onPress={() => remove(e)}>✕</Text>
                  </View>
                  <Muted>Pagó {nameOf(link.paidBy)} · para {(link.participants || []).map(nameOf).join(', ')}</Muted>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <H>Mis movimientos</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip title="Todas" active={!filter} onPress={() => setFilter(null)} />
          {CATEGORIES.map(([k, , icon]) => <Chip key={k} title={icon} active={filter === k} onPress={() => setFilter(k)} />)}
        </View>
        {mine.filter((e) => !filter || catKey(e) === filter).map((e) => {
          const link = linkOf(e);
          return (
            <View key={e.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1 }}>{CATEGORIES.find((c) => c[0] === catKey(e))?.[2]} {e.concept || '-'} <Text style={{ color: colors.muted }}>{fmtDMY(e.date)}{e.orig ? ` · ${e.orig.amount} ${e.orig.currency}` : ''}{e.byName ? ` · ${e.byName}` : ''}</Text></Text>
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
        {!mine.length && <Muted>Todavía no has añadido gastos.</Muted>}
      </Card>
    </ScrollView>
  );
}
