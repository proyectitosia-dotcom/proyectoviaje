// Rango de fechas del viaje (inicio y fin). Lo reparte el viaje abierto a toda la app y
// DateField lo lee para que cualquier selector de fecha solo permita días dentro del rango.
import React, { createContext, useContext } from 'react';

const Ctx = createContext({ start: '', end: '' });
export const useTripRange = () => useContext(Ctx);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Fecha ISO válida (AAAA-MM-DD y día real del calendario)
export const isIsoDate = (d) => {
  if (!ISO.test(d || '')) return false;
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === day;
};
// ¿El viaje tiene un rango válido?
export const hasValidRange = (t) => !!t && isIsoDate(t.startDate) && isIsoDate(t.endDate) && t.endDate >= t.startDate;
// ¿La fecha cae dentro del rango? (sin rango definido, cualquier fecha vale)
export const inRange = (d, { start, end }) => !((start && d < start) || (end && d > end));
// Todos los días del rango, de inicio a fin (máximo 400 por seguridad)
export function daysInRange(start, end) {
  const out = [];
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return out;
  const [y, m, d] = start.split('-').map(Number);
  for (let i = 0; i < 400; i++) {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    const iso = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
    out.push(iso);
    if (iso >= end) break;
  }
  return out;
}

export function TripRangeProvider({ start, end, children }) {
  const value = React.useMemo(() => ({ start: isIsoDate(start) ? start : '', end: isIsoDate(end) ? end : '' }), [start, end]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
