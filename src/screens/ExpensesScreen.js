import React, { useEffect, useState } from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { Card, H, Field, Btn, Chip, Row, Label, Muted, confirm, notify , Text, DateField, useTheme } from '../components/ui';
import { uid } from '../store';
import { money, num, fmtDMY, shareMap } from '../utils';
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

// Participantes a repartir: los elegidos o, si no hay ninguno, todos
const splitIds = (members, value) => (value.participants.length ? value.participants.filter((x) => members.some((m) => m.id === x)) : members.map((m) => m.id));

// Selector de quién pagó, para quién y cómo se reparte (a partes iguales o con cifras exactas en €)
function SharePicker({ members, value, onChange, total = 0 }) {
  const { colors } = useTheme();
  const exact = value.split === 'exact';
  const ids = splitIds(members, value);
  const shares = value.shares || {};
  const sum = r2(ids.reduce((a, id) => a + num(shares[id]), 0));
  const left = r2(total - sum);
  const equalFill = () => {
    const each = ids.length ? Math.floor((total / ids.length) * 100) / 100 : 0;
    const next = {};
    ids.forEach((id, i) => { next[id] = String(i === ids.length - 1 ? r2(total - each * (ids.length - 1)) : each); });
    onChange({ ...value, shares: next });
  };
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
      <Label>Reparto</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip title="Por igual" active={!exact} onPress={() => onChange({ ...value, split: 'equal' })} />
        <Chip title="Cifras exactas" active={exact} onPress={() => onChange({ ...value, split: 'exact' })} />
      </View>
      {exact && (
        <View>
          <Muted>Escribe cuánto corresponde a cada persona, en euros. Tiene que sumar el importe total ({money(total)}).</Muted>
          {ids.map((id) => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <Text style={{ flex: 1 }}>{members.find((m) => m.id === id)?.name}</Text>
              <View style={{ width: 110 }}><Field value={shares[id] ?? ''} keyboardType="decimal-pad" placeholder="0.00" onChangeText={(v) => onChange({ ...value, shares: { ...shares, [id]: v } })} /></View>
              <Text style={{ paddingLeft: 6, paddingBottom: 8 }}>€</Text>
            </View>
          ))}
          <Text style={{ color: Math.abs(left) < 0.01 ? colors.ok : colors.danger, fontWeight: '700' }}>
            {Math.abs(left) < 0.01 ? `✔ Repartido: ${money(sum)}` : left > 0 ? `Faltan ${money(left)} por repartir (${money(sum)} de ${money(total)})` : `Te pasas ${money(-left)} (${money(sum)} de ${money(total)})`}
          </Text>
          <Btn small kind="outline" title="Rellenar a partes iguales" onPress={equalFill} />
        </View>
      )}
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
  const [gform, setGform] = useState({ category: 'comida', concept: '', amount: '', date: '', currency: 'EUR', paidBy: null, participants: [], split: 'equal', shares: {} });
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
  const [catEdit, setCatEdit] = useState(null); // id del gasto cuyo tipo se está cambiando
  const nameOf = (id) => members.find((m) => m.id === id)?.name || '?';
  const partsLabel = (g) => (g.shares ? Object.entries(shareMap(g)).map(([id, v]) => `${nameOf(id)} ${money(v)}`).join(', ') : (g.participants || []).map(nameOf).join(', '));
  // Gasto de grupo vinculado a un gasto del viaje (si el gasto de grupo se borra desde Grupo, deja de estar vinculado)
  const linkOf = (e) => (e.groupId ? group.expenses.find((g) => g.id === e.groupId) : null);
  // Valida el reparto con cifras exactas: devuelve { shares } (o {} si es por igual) o { error }
  const checkSplit = (s, total) => {
    if (s.split !== 'exact') return {};
    const ids = splitIds(members, s);
    const shares = {};
    for (const id of ids) {
      const v = r2(num(s.shares?.[id]));
      if (num(s.shares?.[id]) < 0) return { error: 'Los importes no pueden ser negativos.' };
      if (v > 0) shares[id] = v;
    }
    if (!Object.keys(shares).length) return { error: 'Indica cuánto corresponde a cada persona.' };
    const sum = r2(Object.values(shares).reduce((a, v) => a + v, 0));
    if (Math.abs(sum - total) >= 0.01) return { error: `Las cifras suman ${money(sum)} y el gasto es de ${money(total)}.` };
    return { shares };
  };
  const groupExpense = (e, id, s, shares) => {
    const ids = members.map((m) => m.id);
    const chosen = shares ? Object.keys(shares) : s.participants.filter((x) => ids.includes(x));
    return { id, concept: e.concept || (CATEGORIES.find((c) => c[0] === e.category)?.[1] ?? 'Gasto'), amount: e.amount, paidBy: s.paidBy, participants: chosen.length ? chosen : ids, ...(shares ? { shares } : {}), date: e.date || '', expenseId: e.id };
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
    const sp = checkSplit(gform, amount);
    if (sp.error) return notify('Reparto no válido', sp.error);
    const gid = uid();
    const exp = { id: uid(), category: gform.category, concept: gform.concept.trim(), amount, date, groupId: gid, by: me.id, byName: me.name, ...(orig ? { orig } : {}) };
    update({ expenses: [...expenses, exp], group: { ...group, expenses: [...group.expenses, groupExpense(exp, gid, gform, sp.shares)] } });
    setGform({ ...gform, concept: '', amount: '', participants: [], split: 'equal', shares: {} });
  };
  const confirmShare = (e) => {
    if (!members.some((m) => m.id === sharing.paidBy)) return notify('Elige quién ha pagado');
    const sp = checkSplit(sharing, num(e.amount));
    if (sp.error) return notify('Reparto no válido', sp.error);
    const gid = uid();
    update({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, groupId: gid } : x)), group: { ...group, expenses: [...group.expenses, groupExpense(e, gid, sharing, sp.shares)] } });
    setSharing(null);
  };
  const unshare = (e) => update({ expenses: expenses.map((x) => { if (x.id !== e.id) return x; const { groupId: _g, ...rest } = x; return rest; }), group: { ...group, expenses: group.expenses.filter((g) => g.id !== e.groupId) } });
  const canEdit = (e) => !e.by || e.by === me.id;
  const setCategory = (e, k) => {
    if (!canEdit(e)) return notify('No puedes cambiarlo', `Este gasto lo añadió ${e.byName || 'otra persona'}; solo esa persona puede cambiar su tipo.`);
    update({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, category: k } : x)) });
    setCatEdit(null);
  };
  // Enlace "Cambiar tipo" + selector de categorías de un gasto
  const typeEditor = (e) => (
    <View>
      <Text style={{ color: colors.primary }} onPress={() => setCatEdit(catEdit === e.id ? null : e.id)}>🏷️ Cambiar tipo</Text>
      {catEdit === e.id && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {CATEGORIES.map(([k, label, icon]) => <Chip key={k} title={`${icon} ${catLabel(label)}`} active={catKey(e) === k} onPress={() => setCategory(e, k)} />)}
        </View>
      )}
    </View>
  );
  const remove = (e) => !canEdit(e) ? notify('No puedes eliminarlo', `Este gasto lo añadió ${e.byName || 'otra persona'}; solo esa persona puede eliminarlo.`) : confirm(linkOf(e) ? '¿Eliminar gasto? También se quitará del gasto en grupo.' : '¿Eliminar gasto?', () => update({ expenses: expenses.filter((x) => x.id !== e.id), ...(linkOf(e) ? { group: { ...group, expenses: group.expenses.filter((g) => g.id !== e.groupId) } } : {}) }));
  const catLabel = (label) => label.replace(/^Costes? (de )?/, '').replace(/^./, (c) => c.toUpperCase());
  const sharedExpenses = expenses.filter((e) => linkOf(e));
  const sharedTotal = sharedExpenses.reduce((a, e) => a + num(e.amount), 0);
  const catKey = (e) => (CATEGORIES.some(([k]) => k === e.category) ? e.category : 'otros');
  // Total y resumen INDIVIDUALES: solo los gastos personales que he añadido yo (los gastos en grupo se ven entre todos en la pestaña Grupo)
  // Costes automáticos del viaje: hoteles (gastos que mantiene la pestaña Hoteles) y rutas (coste de cada ruta). Se reflejan solos en su categoría
  const isAuto = (e) => !!(e.hotelId || e.fromHotels || e.fromRoutes);
  const hotelsCost = expenses.filter((e) => e.hotelId).reduce((a, e) => a + num(e.amount), 0);
  const routesCost = (trip.routes || []).reduce((a, r) => a + num(r.cost), 0);
  const mine = expenses.filter((e) => e.by === me.id && !linkOf(e) && !isAuto(e));
  // Mi persona dentro del grupo (se vincula sola al entrar en el viaje)
  const myMemberId = members.find((m) => m.userId === me.id)?.id;
  // Gastos en grupo que he pagado yo: se suman enteros a mi total (categoría del gasto vinculado, o "otros")
  const fronted = myMemberId ? group.expenses.filter((g) => !g.settlement && g.paidBy === myMemberId && !isAuto(expenses.find((x) => x.groupId === g.id) || {})) : [];
  const frontedCat = (g) => { const linked = expenses.find((x) => x.groupId === g.id); return linked ? catKey(linked) : 'otros'; };
  // Pagos de deudas que me han hecho a mí: se van restando de mi total
  const received = myMemberId ? group.expenses.filter((g) => g.settlement && (g.participants || []).includes(myMemberId)) : [];
  const personalTotal = mine.reduce((a, e) => a + num(e.amount), 0);
  const frontedTotal = fronted.reduce((a, g) => a + num(g.amount), 0);
  const receivedTotal = received.reduce((a, g) => a + num(g.amount), 0);
  const autoByCat = { hoteles: hotelsCost, transporte: routesCost };
  // Cada pago que me hacen se resta de las categorías de los gastos en grupo que adelanté, en proporción a lo que esa persona debía en cada una
  const receivedByCat = {};
  received.forEach((st) => {
    const a = num(st.amount);
    const w = {}; let wt = 0;
    fronted.forEach((g) => { const v = st.paidBy === g.paidBy ? 0 : num(shareMap(g)[st.paidBy]); if (v > 0) { const k = frontedCat(g); w[k] = (w[k] || 0) + v; wt += v; } });
    if (wt > 0) Object.entries(w).forEach(([k, v]) => { receivedByCat[k] = (receivedByCat[k] || 0) + (a * v) / wt; });
    else receivedByCat.otros = (receivedByCat.otros || 0) + a;
  });
  const byCat = Object.fromEntries(CATEGORIES.map(([k]) => [k, mine.filter((e) => catKey(e) === k).reduce((a, e) => a + num(e.amount), 0) + fronted.filter((g) => frontedCat(g) === k).reduce((a, g) => a + num(g.amount), 0) + (autoByCat[k] || 0) - (receivedByCat[k] || 0)]));
  const gross = r2(personalTotal + frontedTotal + hotelsCost + routesCost); // base de los porcentajes
  const total = r2(gross - receivedTotal);

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <H>💰 Mi total gastado</H>
        <Text style={{ fontSize: 34, fontWeight: '800', color: colors.primary }}>{money(total)}</Text>
      </Card>

      <Card>
        <H>Mi resumen de gastos</H>
        <Row label="Total de mis gastos" value={money(personalTotal + hotelsCost + routesCost)} />
        <Row label="👥 Pagados por mí en grupo" value={`+ ${money(frontedTotal)}`} />
        <Row label="💸 Dinero que me han pagado" value={`− ${money(receivedTotal)}`} />
        <View style={{ borderTopWidth: 1, borderColor: colors.border, marginVertical: 8 }} />
        {CATEGORIES.map(([k, label, icon]) => (
          <View key={k}>
            <Row label={`${icon} ${label}${total > 0 ? ` (${Math.round((byCat[k] / total) * 100)}%)` : ''}`} value={money(byCat[k])} />
            <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, marginBottom: 4 }}>
              <View style={{ height: 6, width: `${total > 0 ? Math.min(100, Math.max(0, (byCat[k] / total) * 100)) : 0}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
            </View>
          </View>
        ))}
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
            <SharePicker members={members} value={gform} total={convert(gform.amount, gform.currency).eur} onChange={(v) => setGform({ ...gform, ...v })} />
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
                  <Muted>Pagó {nameOf(link.paidBy)} · para {partsLabel(link)}</Muted>
                  {typeEditor(e)}
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
        {[['hoteles', '🏨', 'Hoteles del viaje', hotelsCost, 'Se calcula solo desde la pestaña Hoteles'], ['transporte', '🚆', 'Rutas del viaje', routesCost, 'Se calcula solo desde la pestaña Ruta']].filter(([k, , , c]) => c > 0 && (!filter || filter === k)).map(([k, icon, name, c, hint]) => (
          <View key={k} style={{ paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.bg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1 }}>{icon} {name}</Text>
              <Text style={{ fontWeight: '700' }}>{money(c)}</Text>
            </View>
            <Muted>{hint}</Muted>
          </View>
        ))}
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
                  <Muted style={{ flex: 1 }}>👥 En grupo · pagó {nameOf(link.paidBy)} · para {partsLabel(link)}</Muted>
                  <Text style={{ color: colors.primary, paddingLeft: 8 }} onPress={() => confirm('¿Quitar este gasto del grupo? Seguirá en Gastos.', () => unshare(e))}>Quitar</Text>
                </View>
              ) : members.length > 1 && sharing?.id !== e.id ? (
                <Text style={{ color: colors.primary }} onPress={() => setSharing({ id: e.id, paidBy: null, participants: [], split: 'equal', shares: {} })}>👥 Compartir con el grupo</Text>
              ) : null}
              {typeEditor(e)}
              {!link && sharing?.id === e.id && (
                <View>
                  <SharePicker members={members} value={sharing} total={num(e.amount)} onChange={(v) => setSharing({ ...sharing, ...v })} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn small title="Compartir" onPress={() => confirmShare(e)} />
                    <Btn small kind="outline" title="Cancelar" onPress={() => setSharing(null)} />
                  </View>
                </View>
              )}
            </View>
          );
        })}
        {!mine.length && !(hotelsCost > 0 || routesCost > 0) && <Muted>Todavía no has añadido gastos.</Muted>}
      </Card>
    </ScrollView>
  );
}
