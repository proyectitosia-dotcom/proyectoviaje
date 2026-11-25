import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, Alert, Platform } from 'react-native';

export const colors = { primary: '#1E6FD9', bg: '#F3F6FA', card: '#FFFFFF', text: '#1B2430', muted: '#6B7785', danger: '#D64545', ok: '#2E9E5B', border: '#DDE3EA' };

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export const H = ({ children }) => <Text style={s.h}>{children}</Text>;
export const Label = ({ children }) => <Text style={s.label}>{children}</Text>;
export const Muted = ({ children, style }) => <Text style={[s.muted, style]}>{children}</Text>;

export const Row = ({ label, value }) => (
  <View style={s.row}><Text style={s.rowL}>{label}</Text><Text style={s.rowV}>{value}</Text></View>
);

export const Field = ({ label, ...props }) => (
  <View style={{ marginBottom: 8 }}>
    {label ? <Label>{label}</Label> : null}
    <TextInput placeholderTextColor="#9AA5B1" style={[s.input, props.multiline && { minHeight: 70, textAlignVertical: 'top' }]} {...props} />
  </View>
);

export const Btn = ({ title, onPress, kind = 'primary', small, style }) => (
  <TouchableOpacity onPress={onPress} style={[s.btn, s[kind], small && s.small, style]}>
    <Text style={[s.btnT, kind === 'outline' && { color: colors.primary }]}>{title}</Text>
  </TouchableOpacity>
);

export const LinkText = ({ url, children }) => (
  <Text style={s.link} onPress={() => Linking.openURL(url).catch(() => notify('No se pudo abrir el enlace'))}>{children}</Text>
);

export const Chip = ({ title, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipA]}>
    <Text style={{ color: active ? '#fff' : colors.text, fontSize: 13 }}>{title}</Text>
  </TouchableOpacity>
);

// En web, Alert de React Native no hace nada: usamos los diálogos del navegador.
export const notify = (title, msg) => (Platform.OS === 'web' ? window.alert(msg ? `${title}\n${msg}` : title) : Alert.alert(title, msg));
export const confirm = (msg, onYes) => Platform.OS === 'web' ? (window.confirm(msg) && onYes()) : Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sí', style: 'destructive', onPress: onYes }]);

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  h: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 3 },
  muted: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowL: { color: colors.muted, flex: 1 },
  rowV: { color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', color: colors.text },
  btn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', marginVertical: 4 },
  small: { paddingVertical: 6, paddingHorizontal: 10 },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  ok: { backgroundColor: colors.ok },
  outline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent' },
  btnT: { color: '#fff', fontWeight: '600' },
  link: { color: colors.primary, textDecorationLine: 'underline', marginVertical: 2 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6, backgroundColor: '#fff' },
  chipA: { backgroundColor: colors.primary, borderColor: colors.primary },
});
