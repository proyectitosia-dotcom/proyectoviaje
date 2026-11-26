import React, { useMemo, useState } from 'react';
import { View, Text as RNText, TextInput, TouchableOpacity, StyleSheet, Linking, Alert, Platform, Modal } from 'react-native';
import { useTheme } from '../theme';
export { useTheme };
import { fmtDMY, todayISO } from '../utils';
import { useTripRange, inRange } from '../tripRange';

// Estilos que dependen del tema (claro/oscuro)
export const useStyles = (factory) => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
};

const makeStyles = (c) => ({
  card: { backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  h: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
  label: { fontSize: 13, color: c.muted, marginBottom: 3 },
  muted: { color: c.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowL: { color: c.muted, flex: 1 },
  rowV: { color: c.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.input, color: c.text },
  btn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', marginVertical: 4 },
  small: { paddingVertical: 6, paddingHorizontal: 10 },
  primary: { backgroundColor: c.primary },
  danger: { backgroundColor: c.danger },
  ok: { backgroundColor: c.ok },
  outline: { borderWidth: 1, borderColor: c.primary, backgroundColor: 'transparent' },
  btnT: { color: c.onPrimary, fontWeight: '600' },
  link: { color: c.primary, textDecorationLine: 'underline', marginVertical: 2 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6, backgroundColor: c.input },
  chipA: { backgroundColor: c.primary, borderColor: c.primary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  cal: { backgroundColor: c.card, borderRadius: 14, padding: 14, width: '100%', maxWidth: 380, alignSelf: 'center' },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calNav: { fontSize: 22, color: c.primary, paddingHorizontal: 10, paddingVertical: 2 },
  calTitle: { fontWeight: '700', color: c.text, fontSize: 16, textTransform: 'capitalize' },
  calWeek: { flexDirection: 'row' },
  calWd: { width: `${100 / 7}%`, textAlign: 'center', color: c.muted, fontSize: 12, paddingVertical: 4 },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  calSel: { backgroundColor: c.primary },
  calToday: { borderWidth: 1, borderColor: c.primary },
  calDay: { color: c.text },
});

export const Text = ({ style, ...p }) => { const { colors } = useTheme(); return <RNText {...p} style={[{ color: colors.text }, style]} />; };

export const Card = ({ children, style }) => { const s = useStyles(makeStyles); return <View style={[s.card, style]}>{children}</View>; };
export const H = ({ children }) => { const s = useStyles(makeStyles); return <Text style={s.h}>{children}</Text>; };
export const Label = ({ children }) => { const s = useStyles(makeStyles); return <Text style={s.label}>{children}</Text>; };
export const Muted = ({ children, style }) => { const s = useStyles(makeStyles); return <Text style={[s.muted, style]}>{children}</Text>; };

export const Row = ({ label, value }) => {
  const s = useStyles(makeStyles);
  return <View style={s.row}><Text style={s.rowL}>{label}</Text><Text style={s.rowV}>{value}</Text></View>;
};

export const Field = ({ label, ...props }) => {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 8 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput placeholderTextColor={colors.placeholder} style={[s.input, props.multiline && { minHeight: 70, textAlignVertical: 'top' }]} {...props} />
    </View>
  );
};

export const Btn = ({ title, onPress, kind = 'primary', small, style }) => {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[s.btn, s[kind], small && s.small, style]}>
      <Text style={[s.btnT, kind === 'outline' && { color: colors.primary }, kind !== 'outline' && kind !== 'primary' && { color: '#fff' }]}>{title}</Text>
    </TouchableOpacity>
  );
};

export const LinkText = ({ url, children }) => {
  const s = useStyles(makeStyles);
  return <Text style={s.link} onPress={() => Linking.openURL(url).catch(() => notify('No se pudo abrir el enlace'))}>{children}</Text>;
};

export const Chip = ({ title, active, onPress }) => {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipA]}>
      <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 13 }}>{title}</Text>
    </TouchableOpacity>
  );
};

// ---------- Selector de fecha con calendario (se muestra dd-mm-aaaa, se guarda AAAA-MM-DD) ----------
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const pad = (n) => String(n).padStart(2, '0');

// Selector de fecha reutilizable. Por defecto solo permite días DENTRO del rango del viaje (inicio-fin);
// con la prop `unrestricted` se puede elegir cualquier día (solo para fijar el propio rango).
// `min` / `max` (AAAA-MM-DD) permiten acotar aún más (p. ej. la salida no antes de la entrada).
export function DateField({ label, value, onChange, placeholder = 'dd-mm-aaaa', unrestricted = false, min, max }) {
  const s = useStyles(makeStyles);
  const { colors } = useTheme();
  const trip = useTripRange();
  const lo = [unrestricted ? '' : trip.start, min || ''].filter(Boolean).sort().pop() || ''; // el más tardío de los mínimos
  const hi = [unrestricted ? '' : trip.end, max || ''].filter(Boolean).sort()[0] || '';       // el más temprano de los máximos
  const allowed = (d) => inRange(d, { start: lo, end: hi });
  const [open, setOpen] = useState(false);
  // Mes que se muestra al abrir: el de la fecha elegida o, si no hay, el más cercano al rango permitido
  const startView = () => {
    const today = todayISO();
    let base = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : today;
    if (!allowed(base)) base = lo && base < lo ? lo : hi || base;
    return { y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 };
  };
  const [view, setView] = useState(startView);

  const show = () => { setView(startView()); setOpen(true); };
  const shift = (dm) => setView(({ y, m }) => { const t = y * 12 + m + dm; return { y: Math.floor(t / 12), m: t % 12 }; });
  const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // lunes = 0
  const total = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const iso = (d) => `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
  const pick = (d) => { if (!allowed(iso(d))) return; onChange(iso(d)); setOpen(false); }; // los días fuera del rango no se pueden elegir
  const today = todayISO();

  return (
    <View style={{ marginBottom: 8 }}>
      {label ? <Label>{label}</Label> : null}
      <TouchableOpacity onPress={show} style={[s.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={{ color: value ? colors.text : colors.placeholder }}>{value ? fmtDMY(value) : placeholder}</Text>
        <Text>📅</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={s.overlay} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={s.cal}>
            <View style={s.calHead}>
              <Text style={s.calNav} onPress={() => shift(-12)}>«</Text>
              <Text style={s.calNav} onPress={() => shift(-1)}>‹</Text>
              <Text style={s.calTitle}>{MONTHS[view.m]} {view.y}</Text>
              <Text style={s.calNav} onPress={() => shift(1)}>›</Text>
              <Text style={s.calNav} onPress={() => shift(12)}>»</Text>
            </View>
            {(lo || hi) ? <Text style={{ textAlign: 'center', fontSize: 12, color: colors.muted, marginBottom: 4 }}>Solo se pueden elegir días entre {lo ? fmtDMY(lo) : '…'} y {hi ? fmtDMY(hi) : '…'}</Text> : null}
            <View style={s.calWeek}>{WEEK.map((w) => <Text key={w} style={s.calWd}>{w}</Text>)}</View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((d, i) => d === null ? <View key={`e${i}`} style={s.calCell} /> : (
                <TouchableOpacity key={d} disabled={!allowed(iso(d))} style={[s.calCell, iso(d) === today && s.calToday, iso(d) === value && s.calSel, !allowed(iso(d)) && { opacity: 0.25 }]} onPress={() => pick(d)}>
                  <Text style={[s.calDay, iso(d) === value && { color: colors.onPrimary, fontWeight: '700' }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {allowed(today) && <Btn small kind="outline" title="Hoy" style={{ flex: 1 }} onPress={() => { onChange(today); setOpen(false); }} />}
              <Btn small kind="outline" title="Borrar" style={{ flex: 1 }} onPress={() => { onChange(''); setOpen(false); }} />
              <Btn small title="Cerrar" style={{ flex: 1 }} onPress={() => setOpen(false)} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// En web, Alert de React Native no hace nada: usamos los diálogos del navegador.
export const notify = (title, msg) => (Platform.OS === 'web' ? window.alert(msg ? `${title}\n${msg}` : title) : Alert.alert(title, msg));
export const confirm = (msg, onYes) => Platform.OS === 'web' ? (window.confirm(msg) && onYes()) : Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sí', style: 'destructive', onPress: onYes }]);
