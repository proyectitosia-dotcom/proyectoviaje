// Divisas compartidas: los importes se guardan SIEMPRE en euros.
// El cambio (euros por 1 unidad de cada divisa) es global al viaje (trip.fx) y se renueva solo desde el BCE.
import { useEffect, useState } from 'react';
import { num } from './utils';

export const CURRENCIES = [['EUR', 'Euro'], ['USD', 'Dólar EE. UU.'], ['GBP', 'Libra esterlina'], ['JPY', 'Yen'], ['CHF', 'Franco suizo'], ['CAD', 'Dólar canadiense'], ['AUD', 'Dólar australiano'], ['MXN', 'Peso mexicano'], ['CNY', 'Yuan']];
export const DEFAULT_RATES = { USD: 0.92, GBP: 1.17, JPY: 0.0062, CHF: 1.05, CAD: 0.67, AUD: 0.6, MXN: 0.05, CNY: 0.13 };
export const FX_MAX_AGE = 3600 * 1000; // los cambios se renuevan solos si tienen más de 1 hora
export const roundMoney = (x) => Math.round(x * 100) / 100;

// Euros por 1 unidad de la divisa `c`, según los cambios guardados del viaje (o los de por defecto)
export const rateFor = (fx, c) => (c === 'EUR' ? 1 : num((fx || {})[c]) > 0 ? num(fx[c]) : DEFAULT_RATES[c] || 1);

// Importe escrito en la divisa `cur` -> euros (con el importe original para poder mostrarlo)
export function toEuros(text, cur, fx) {
  const orig = roundMoney(num(text));
  const rate = rateFor(fx, cur);
  return { eur: roundMoney(orig * rate), ...(cur !== 'EUR' ? { orig: { amount: orig, currency: cur, rate } } : {}) };
}

// Cotizaciones online (euros por 1 unidad de cada divisa). Fuente principal: BCE vía Frankfurter; respaldo: open.er-api.com
export async function fetchRates() {
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

// Hook para cualquier pantalla con selector de divisa: devuelve los cambios del viaje y la conversión a euros.
// Se actualizan solos al abrir la pantalla (y al elegir una divisa, con ensureFresh) si tienen más de 1 hora.
export function useRates(trip, update) {
  const fx = trip.fx || {};
  const [status, setStatus] = useState('');
  const rateOf = (c) => rateFor(fx, c);
  const convert = (text, cur) => toEuros(text, cur, fx);
  const refreshRates = async () => {
    setStatus('Actualizando cambios…');
    try {
      const { rates, source } = await fetchRates();
      await update({ fx: { ...fx, ...rates }, fxAt: Date.now() });
      setStatus(`Cambios actualizados (${source}) · ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) { setStatus('No se pudo actualizar online; se usan los últimos cambios guardados.'); }
  };
  const ensureFresh = () => { if (!trip.fxAt || Date.now() - trip.fxAt > FX_MAX_AGE) refreshRates(); };
  useEffect(() => { ensureFresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { fx, rateOf, convert, refreshRates, ensureFresh, status };
}
