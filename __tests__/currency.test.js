// src/currency.js: conversión a euros, descarga de cambios (fetch mockeado) y hook useRates.
import { renderHook, waitFor } from '@testing-library/react-native';
import { CURRENCIES, DEFAULT_RATES, FX_MAX_AGE, roundMoney, rateFor, toEuros, fetchRates, useRates } from '../src/currency';

const COD = ['USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'MXN', 'CNY'];
// «1 EUR = X divisa» (como lo devuelven las fuentes)
const PER_EUR = { USD: 1.25, GBP: 0.8, JPY: 160, CHF: 0.95, CAD: 1.5, AUD: 1.6, MXN: 20, CNY: 7.8 };
const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const fuenteBCE = () => ok({ rates: PER_EUR });

describe('currency: helpers puros', () => {
  test('hay 9 divisas con el euro la primera y cambios por defecto para las otras 8', () => {
    expect(CURRENCIES).toHaveLength(9);
    expect(CURRENCIES[0][0]).toBe('EUR');
    expect(Object.keys(DEFAULT_RATES).sort()).toEqual([...COD].sort());
  });
  test('roundMoney redondea a céntimos', () => {
    expect(roundMoney(1.005 * 100 / 100)).toBeCloseTo(1, 1);
    expect(roundMoney(12.3456)).toBe(12.35);
    expect(roundMoney(0)).toBe(0);
  });
  test('rateFor: el euro vale 1, usa el cambio del viaje y si falta el de por defecto', () => {
    expect(rateFor({ USD: 0.9 }, 'EUR')).toBe(1);
    expect(rateFor({ USD: 0.9 }, 'USD')).toBe(0.9);
    expect(rateFor({}, 'USD')).toBe(DEFAULT_RATES.USD);
    expect(rateFor(undefined, 'GBP')).toBe(DEFAULT_RATES.GBP);
    expect(rateFor({ USD: 'x' }, 'USD')).toBe(DEFAULT_RATES.USD);
    expect(rateFor({ USD: -1 }, 'USD')).toBe(DEFAULT_RATES.USD);
    expect(rateFor({}, 'XXX')).toBe(1);
  });
  test('toEuros: en euros no añade «orig»', () => {
    expect(toEuros('12,5', 'EUR', {})).toEqual({ eur: 12.5 });
  });
  test('toEuros: en otra divisa convierte y guarda el importe original', () => {
    expect(toEuros('100', 'USD', { USD: 0.9 })).toEqual({ eur: 90, orig: { amount: 100, currency: 'USD', rate: 0.9 } });
    expect(toEuros('33,33', 'USD', { USD: 0.9 }).eur).toBe(30);
  });
  test('toEuros: texto no numérico da 0', () => {
    expect(toEuros('abc', 'USD', { USD: 0.9 }).eur).toBe(0);
  });
});

describe('currency: fetchRates', () => {
  test('usa el BCE (Frankfurter) y devuelve euros por 1 unidad de cada divisa', async () => {
    fetch.mockResolvedValueOnce(fuenteBCE());
    const { rates, source } = await fetchRates();
    expect(source).toBe('BCE');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,JPY,CHF,CAD,AUD,MXN,CNY');
    expect(Object.keys(rates).sort()).toEqual([...COD].sort());
    expect(rates.USD).toBe(0.8);
    expect(rates.GBP).toBe(1.25);
    expect(rates.JPY).toBe(0.00625);
  });
  test('si el BCE falla usa open.er-api.com', async () => {
    fetch.mockRejectedValueOnce(new Error('Network request failed'));
    fetch.mockResolvedValueOnce(ok({ result: 'success', rates: { ...PER_EUR, EUR: 1 } }));
    const r = await fetchRates();
    expect(r.source).toBe('open.er-api.com');
    expect(fetch.mock.calls[1][0]).toBe('https://open.er-api.com/v6/latest/EUR');
    expect(r.rates.USD).toBe(0.8);
  });
  test('una respuesta incompleta o con error HTTP pasa a la siguiente fuente', async () => {
    const { CNY, ...incompleto } = PER_EUR;
    fetch.mockResolvedValueOnce(ok({ rates: incompleto }));
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchRates()).rejects.toThrow('sin conexión con las fuentes de cambio');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  test('open.er-api con result distinto de success se ignora', async () => {
    fetch.mockRejectedValueOnce(new Error('x'));
    fetch.mockResolvedValueOnce(ok({ result: 'error', rates: PER_EUR }));
    await expect(fetchRates()).rejects.toThrow();
  });
  test('sin conexión lanza error y nunca otra cosa', async () => {
    await expect(fetchRates()).rejects.toThrow('sin conexión con las fuentes de cambio');
  });
});

describe('currency: useRates', () => {
  const montar = (trip, update = jest.fn(async () => {})) => ({ update, ...renderHook(() => useRates(trip, update)) });

  test('con cambios recientes no descarga nada al abrir y convierte con los del viaje', () => {
    const { result } = montar({ fx: { USD: 0.9 }, fxAt: Date.now() });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.rateOf('USD')).toBe(0.9);
    expect(result.current.rateOf('EUR')).toBe(1);
    expect(result.current.convert('100', 'USD')).toEqual({ eur: 90, orig: { amount: 100, currency: 'USD', rate: 0.9 } });
    expect(result.current.status).toBe('');
  });

  test('sin fecha de actualización descarga al abrir y guarda fx + fxAt conservando los cambios previos', async () => {
    fetch.mockResolvedValueOnce(fuenteBCE());
    const { result, update } = montar({ fx: { USD: 0.9, XYZ: 5 } });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const patch = update.mock.calls[0][0];
    expect(patch.fx.USD).toBe(0.8);
    expect(patch.fx.XYZ).toBe(5);
    expect(typeof patch.fxAt).toBe('number');
    await waitFor(() => expect(result.current.status).toMatch(/^Cambios actualizados \(BCE\) · \d\d:\d\d$/));
  });

  test('con cambios de más de 1 hora también se renuevan al abrir', async () => {
    fetch.mockResolvedValueOnce(fuenteBCE());
    const { update } = montar({ fx: {}, fxAt: Date.now() - FX_MAX_AGE - 1000 });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  });

  test('sin conexión avisa y mantiene los guardados (no llama a update)', async () => {
    const { result, update } = montar({ fx: { USD: 0.9 } });
    await waitFor(() => expect(result.current.status).toBe('No se pudo actualizar online; se usan los últimos cambios guardados.'));
    expect(update).not.toHaveBeenCalled();
    expect(result.current.rateOf('USD')).toBe(0.9);
  });

  test('ensureFresh solo descarga si hace falta', async () => {
    const { result } = montar({ fx: {}, fxAt: Date.now() });
    result.current.ensureFresh();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('refreshRates fuerza la descarga aunque los cambios sean recientes', async () => {
    fetch.mockResolvedValueOnce(fuenteBCE());
    const { result, update } = montar({ fx: {}, fxAt: Date.now() });
    await result.current.refreshRates();
    expect(update).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
