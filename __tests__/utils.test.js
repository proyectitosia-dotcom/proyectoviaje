import {
  money, num, addDays, datesBetween, googleMapsRouteUrl, shareMap, settleUp, fmtDMY, fmtDM, normalizeTrip,
} from '../src/utils';

describe('utils: números y dinero', () => {
  test('money formatea con dos decimales y euro', () => {
    expect(money(12.5)).toBe('12.50 €');
    expect(money('abc')).toBe('0.00 €');
    expect(money(null)).toBe('0.00 €');
  });
  test('num acepta coma decimal y devuelve 0 si no es número', () => {
    expect(num('3,5')).toBe(3.5);
    expect(num('12')).toBe(12);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
  });
});

describe('utils: fechas', () => {
  test('addDays suma días cruzando mes, año y bisiestos', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-10', -10)).toBe('2026-02-28');
  });
  test('addDays devuelve null con una fecha inválida', () => {
    expect(addDays('no-es-fecha', 1)).toBeNull();
  });
  test('datesBetween lista las noches: incluye la entrada y excluye la salida', () => {
    expect(datesBetween('2026-06-01', '2026-06-04')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(datesBetween('2026-06-01', '2026-06-01')).toEqual([]);
    expect(datesBetween('2026-06-05', '2026-06-01')).toEqual([]);
  });
  test('datesBetween no pasa de 365 días', () => {
    expect(datesBetween('2026-01-01', '2030-01-01')).toHaveLength(365);
  });
  test('fmtDMY y fmtDM pasan de AAAA-MM-DD a dd-mm-aaaa y dd-mm', () => {
    expect(fmtDMY('2026-12-01')).toBe('01-12-2026');
    expect(fmtDM('2026-12-01')).toBe('01-12');
  });
  test('fmtDMY deja pasar lo que no es una fecha ISO y no falla con vacíos', () => {
    expect(fmtDMY('')).toBe('');
    expect(fmtDMY(undefined)).toBe('');
    expect(fmtDMY('01/12/2026')).toBe('01/12/2026');
    expect(fmtDM('01/12/2026')).toBe('');
  });
});

describe('utils: googleMapsRouteUrl', () => {
  test('construye origen, destino, modo y paradas codificadas', () => {
    expect(googleMapsRouteUrl('Madrid', 'Valencia', ['A', 'B'], 'driving')).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=Madrid&destination=Valencia&travelmode=driving&waypoints=A%7CB',
    );
  });
  test('codifica espacios y acentos', () => {
    const url = googleMapsRouteUrl('Plaza Mayor', 'Málaga', [], 'walking');
    expect(url).toContain('origin=Plaza%20Mayor');
    expect(url).toContain('destination=M%C3%A1laga');
    expect(url).not.toContain('waypoints');
  });
  test('modo desconocido o ausente usa transporte público', () => {
    expect(googleMapsRouteUrl('A', 'B', [], 'volando')).toContain('travelmode=transit');
    expect(googleMapsRouteUrl('A', 'B')).toContain('travelmode=transit');
  });
  test('es robusto con datos incompletos (paradas null o texto, sin origen)', () => {
    expect(googleMapsRouteUrl(undefined, undefined, null, 'driving')).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=&destination=&travelmode=driving',
    );
    expect(googleMapsRouteUrl('A', 'B', 'texto', 'driving')).not.toContain('waypoints');
  });
  test('ignora paradas vacías', () => {
    expect(googleMapsRouteUrl('A', 'B', ['', 'C', null], 'driving')).toContain('waypoints=C');
  });
});

describe('utils: shareMap (reparto de un gasto)', () => {
  test('a partes iguales entre los participantes', () => {
    expect(shareMap({ amount: '30', participants: ['a', 'b', 'c'] })).toEqual({ a: 10, b: 10, c: 10 });
  });
  test('con cifras exactas usa esas cifras y descarta las de 0', () => {
    expect(shareMap({ amount: '30', shares: { a: '20', b: '10', c: '0' } })).toEqual({ a: 20, b: 10 });
  });
  test('cifras exactas con coma decimal', () => {
    expect(shareMap({ shares: { a: '12,5', b: '7,5' } })).toEqual({ a: 12.5, b: 7.5 });
  });
  test('si las cifras exactas están vacías o a 0 vuelve al reparto igualitario', () => {
    expect(shareMap({ amount: '10', participants: ['a', 'b'], shares: {} })).toEqual({ a: 5, b: 5 });
    expect(shareMap({ amount: '10', participants: ['a', 'b'], shares: { a: '0' } })).toEqual({ a: 5, b: 5 });
  });
  test('sin participantes ni cifras devuelve vacío; también con undefined', () => {
    expect(shareMap({ amount: '10' })).toEqual({});
    expect(shareMap(undefined)).toEqual({});
  });
});

describe('utils: settleUp (cuadre de gastos)', () => {
  const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  test('un gasto entre dos personas: el otro debe la mitad', () => {
    const r = settleUp([{ id: 'a' }, { id: 'b' }], [{ paidBy: 'a', amount: '100', participants: ['a', 'b'] }]);
    expect(r.balances.a).toBeCloseTo(50);
    expect(r.balances.b).toBeCloseTo(-50);
    expect(r.transfers).toHaveLength(1);
    expect(r.transfers[0]).toMatchObject({ from: 'b', to: 'a' });
    expect(r.transfers[0].amount).toBeCloseTo(50);
  });

  test('con cifras exactas cada uno debe lo suyo', () => {
    const r = settleUp([{ id: 'a' }, { id: 'b' }], [{ paidBy: 'a', amount: '100', shares: { a: '30', b: '70' } }]);
    expect(r.balances.a).toBeCloseTo(70);
    expect(r.balances.b).toBeCloseTo(-70);
    expect(r.transfers[0]).toMatchObject({ from: 'b', to: 'a' });
    expect(r.transfers[0].amount).toBeCloseTo(70);
  });

  test('varios gastos cruzados dan transferencias mínimas', () => {
    const r = settleUp(members, [
      { paidBy: 'a', amount: '90', participants: ['a', 'b', 'c'] },
      { paidBy: 'b', amount: '60', participants: ['a', 'b'] },
    ]);
    expect(r.balances.a).toBeCloseTo(30);
    expect(r.balances.b).toBeCloseTo(0);
    expect(r.balances.c).toBeCloseTo(-30);
    expect(r.transfers).toHaveLength(1);
    expect(r.transfers[0]).toMatchObject({ from: 'c', to: 'a' });
    expect(r.transfers[0].amount).toBeCloseTo(30);
  });

  test('los saldos siempre suman 0 y las transferencias saldan todas las deudas', () => {
    const r = settleUp(members, [
      { paidBy: 'a', amount: '10', participants: ['a', 'b', 'c'] },
      { paidBy: 'b', amount: '33.33', participants: ['a', 'b', 'c'] },
      { paidBy: 'c', amount: '7,5', participants: ['b', 'c'] },
      { paidBy: 'a', amount: '20', shares: { b: '5', c: '15' } },
    ]);
    const sum = Object.values(r.balances).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(0);
    const after = { ...r.balances };
    r.transfers.forEach((t) => { after[t.from] += t.amount; after[t.to] -= t.amount; });
    Object.values(after).forEach((v) => expect(Math.abs(v)).toBeLessThan(0.01));
  });

  test('ignora gastos de quien no es miembro y participantes desconocidos', () => {
    const r = settleUp([{ id: 'a' }, { id: 'b' }], [
      { paidBy: 'zzz', amount: '50', participants: ['a', 'b'] },
      { paidBy: 'a', amount: '40', participants: ['a', 'b', 'fantasma'] },
    ]);
    expect(r.balances.a).toBeCloseTo(20);
    expect(r.balances.b).toBeCloseTo(-20);
  });

  test('sin gastos no hay transferencias', () => {
    expect(settleUp(members, [])).toEqual({ balances: { a: 0, b: 0, c: 0 }, transfers: [] });
  });

  test('un gasto sin participantes se ignora', () => {
    const r = settleUp(members, [{ paidBy: 'a', amount: '50', participants: [] }]);
    expect(r.transfers).toEqual([]);
  });
});

describe('utils: normalizeTrip', () => {
  test('rellena listas y objetos que faltan', () => {
    expect(normalizeTrip({ name: 'Roma' })).toEqual({
      name: 'Roma', routes: [], hotels: [], days: [], expenses: [], fx: {}, group: { members: [], expenses: [] },
    });
  });
  test('descarta elementos que no son objetos y valores null', () => {
    const t = normalizeTrip({ routes: [null, { id: 1 }, 'x', 3], hotels: null, group: null, fx: 'mal' });
    expect(t.routes).toEqual([{ id: 1 }]);
    expect(t.hotels).toEqual([]);
    expect(t.fx).toEqual({});
    expect(t.group).toEqual({ members: [], expenses: [] });
  });
  test('conserva los datos existentes del grupo', () => {
    const t = normalizeTrip({ group: { name: 'Amigos', members: [{ id: 'a' }], expenses: 'roto' } });
    expect(t.group).toEqual({ name: 'Amigos', members: [{ id: 'a' }], expenses: [] });
  });
  test('devuelve tal cual null y valores que no son objetos', () => {
    expect(normalizeTrip(null)).toBeNull();
    expect(normalizeTrip(undefined)).toBeUndefined();
    expect(normalizeTrip('hola')).toBe('hola');
  });
});
