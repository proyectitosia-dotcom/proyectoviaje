import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { isIsoDate, hasValidRange, inRange, daysInRange, TripRangeProvider, useTripRange } from '../src/tripRange';

describe('tripRange: isIsoDate', () => {
  test('acepta fechas reales', () => {
    expect(isIsoDate('2026-12-01')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });
  test('rechaza días que no existen y formatos incorrectos', () => {
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
    expect(isIsoDate('01-12-2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('tripRange: hasValidRange', () => {
  test('rango correcto, incluido un solo día', () => {
    expect(hasValidRange({ startDate: '2026-12-01', endDate: '2026-12-05' })).toBe(true);
    expect(hasValidRange({ startDate: '2026-12-01', endDate: '2026-12-01' })).toBe(true);
  });
  test('fin anterior al inicio, fechas inválidas o viaje vacío', () => {
    expect(hasValidRange({ startDate: '2026-12-05', endDate: '2026-12-01' })).toBe(false);
    expect(hasValidRange({ startDate: 'x', endDate: '2026-12-01' })).toBe(false);
    expect(hasValidRange({ startDate: '2026-12-01' })).toBe(false);
    expect(hasValidRange({})).toBe(false);
    expect(hasValidRange(null)).toBe(false);
  });
});

describe('tripRange: inRange', () => {
  const r = { start: '2026-12-01', end: '2026-12-05' };
  test('dentro del rango, bordes incluidos', () => {
    expect(inRange('2026-12-03', r)).toBe(true);
    expect(inRange('2026-12-01', r)).toBe(true);
    expect(inRange('2026-12-05', r)).toBe(true);
  });
  test('fuera del rango', () => {
    expect(inRange('2026-11-30', r)).toBe(false);
    expect(inRange('2026-12-06', r)).toBe(false);
  });
  test('sin rango cualquier fecha vale; con solo un extremo se respeta ese extremo', () => {
    expect(inRange('1999-01-01', { start: '', end: '' })).toBe(true);
    expect(inRange('2026-11-30', { start: '2026-12-01', end: '' })).toBe(false);
    expect(inRange('2030-01-01', { start: '2026-12-01', end: '' })).toBe(true);
    expect(inRange('2026-12-06', { start: '', end: '2026-12-05' })).toBe(false);
  });
});

describe('tripRange: daysInRange', () => {
  test('lista todos los días de inicio a fin, también cruzando año', () => {
    expect(daysInRange('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
  test('un solo día', () => {
    expect(daysInRange('2026-12-01', '2026-12-01')).toEqual(['2026-12-01']);
  });
  test('rango inválido o invertido devuelve lista vacía', () => {
    expect(daysInRange('2026-12-05', '2026-12-01')).toEqual([]);
    expect(daysInRange('x', '2026-12-01')).toEqual([]);
    expect(daysInRange('', '')).toEqual([]);
  });
  test('máximo 400 días por seguridad', () => {
    expect(daysInRange('2026-01-01', '2030-01-01')).toHaveLength(400);
  });
});

describe('tripRange: TripRangeProvider / useTripRange', () => {
  const wrap = (props) => ({ children }) => <TripRangeProvider {...props}>{children}</TripRangeProvider>;
  test('reparte el rango a quien lo lea', () => {
    const { result } = renderHook(() => useTripRange(), { wrapper: wrap({ start: '2026-12-01', end: '2026-12-05' }) });
    expect(result.current).toEqual({ start: '2026-12-01', end: '2026-12-05' });
  });
  test('ignora fechas inválidas', () => {
    const { result } = renderHook(() => useTripRange(), { wrapper: wrap({ start: '2026-02-30', end: 'x' }) });
    expect(result.current).toEqual({ start: '', end: '' });
  });
  test('sin proveedor el rango está vacío', () => {
    const { result } = renderHook(() => useTripRange());
    expect(result.current).toEqual({ start: '', end: '' });
  });
});
