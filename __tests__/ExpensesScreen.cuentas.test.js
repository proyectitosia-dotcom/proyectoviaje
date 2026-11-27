// Pantalla Gastos: divisas, totales individuales y reparto con cifras exactas.
import React from 'react';
import { Alert, TextInput } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ExpensesScreen from '../src/screens/ExpensesScreen';

jest.mock('../src/user', () => ({ useMe: () => ({ me: { id: 'u1', name: 'Ana' }, ready: true }) }));

const FRESCO = () => Date.now();   // cambios recientes: no se descargan al abrir
const miembros2 = [{ id: 'm1', name: 'Ana', userId: 'u1' }, { id: 'm2', name: 'Luis' }];
const miembros3 = [...miembros2, { id: 'm3', name: 'Eva' }];

let alerta;
beforeEach(() => { alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

const montar = (trip) => {
  const update = jest.fn();
  render(<ExpensesScreen trip={{ fxAt: FRESCO(), ...trip }} update={update} />);
  return update;
};
const aviso = (titulo) => [...alerta.mock.calls].reverse().find((c) => c[0] === titulo);   // la más reciente
// Campos de importe (teclado decimal) por orden: [personal, grupo, ...cifras exactas]
const importes = () => screen.UNSAFE_getAllByType(TextInput).filter((t) => t.props.keyboardType === 'decimal-pad');

describe('Gastos: totales individuales', () => {
  const trip = {
    group: {
      members: miembros2,
      expenses: [
        { id: 'g1', amount: 90, paidBy: 'm1', participants: ['m1', 'm2'], expenseId: 'e3' },                // pagado por mí
        { id: 'g2', amount: 30, paidBy: 'm2', participants: ['m1'], settlement: true },                       // Luis me paga 30
        { id: 'g3', amount: 40, paidBy: 'm2', participants: ['m1', 'm2'], expenseId: 'e4' },                // pagado por Luis: no es mío
      ],
    },
    expenses: [
      { id: 'e1', category: 'comida', concept: 'Mío', amount: 20, by: 'u1' },
      { id: 'e2', category: 'comida', concept: 'De otra persona', amount: 99, by: 'u2' },
      { id: 'e3', category: 'comida', concept: 'Cena grupo', amount: 90, by: 'u1', groupId: 'g1' },
      { id: 'e4', category: 'comida', concept: 'Taxi grupo', amount: 40, by: 'u2', groupId: 'g3' },
    ],
  };

  test('«Mi total» suma mis gastos + lo que adelanté en grupo − lo que me han pagado', () => {
    montar(trip);
    expect(screen.getAllByText('80.00 €')[0]).toBeTruthy(); // 20 + 90 − 30: el gran total (y su categoría)
    expect(screen.getByText('Total de mis gastos')).toBeTruthy();
    expect(screen.getByText('+ 90.00 €')).toBeTruthy();     // pagados por mí en grupo
    expect(screen.getByText('− 30.00 €')).toBeTruthy();     // me han pagado
  });

  test('los gastos de otras personas y los que pagó otra persona no entran en mi total', () => {
    montar(trip);
    expect(screen.queryByText('119.00 €')).toBeNull();      // 20 + 99
    expect(screen.queryByText('99.00 €')).toBeNull();
  });

  test('sin gastos el total es 0 y avisa de que no hay ninguno', () => {
    montar({ expenses: [], group: { members: [], expenses: [] } });
    expect(screen.getAllByText('0.00 €').length).toBeGreaterThan(0);
    expect(screen.getByText('Todavía no has añadido gastos.')).toBeTruthy();
  });
});

describe('Gastos: divisas en «Añadir gasto»', () => {
  test('en USD muestra la conversión y guarda el importe en euros con el original', () => {
    const update = montar({ fx: { USD: 0.9 }, expenses: [], group: { members: [], expenses: [] } });
    fireEvent.changeText(importes()[0], '100');
    fireEvent.press(screen.getByText('USD'));
    expect(screen.getByText('≈ 90.00 € (1 USD = 0.9 €)')).toBeTruthy();
    fireEvent.press(screen.getByText('Añadir'));
    const [e] = update.mock.calls[0][0].expenses;
    expect(e).toMatchObject({ amount: 90, by: 'u1', byName: 'Ana', orig: { amount: 100, currency: 'USD', rate: 0.9 } });
  });

  test('en euros no guarda «orig»', () => {
    const update = montar({ expenses: [], group: { members: [], expenses: [] } });
    fireEvent.changeText(importes()[0], '12,5');
    fireEvent.press(screen.getByText('Añadir'));
    const [e] = update.mock.calls[0][0].expenses;
    expect(e.amount).toBe(12.5);
    expect(e.orig).toBeUndefined();
  });

  test('un importe vacío, 0 o no numérico no se añade', () => {
    const update = montar({ expenses: [], group: { members: [], expenses: [] } });
    fireEvent.press(screen.getByText('Añadir'));
    fireEvent.changeText(importes()[0], 'abc');
    fireEvent.press(screen.getByText('Añadir'));
    expect(aviso('Importe no válido')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  test('sin cambios guardados usa los de por defecto (USD = 0.92 €)', () => {
    montar({ expenses: [], group: { members: [], expenses: [] } });
    fireEvent.press(screen.getByText('USD'));
    expect(screen.getByText('≈ 0.00 € (1 USD = 0.92 €)')).toBeTruthy();
  });

  test('la tarjeta «Cambio de divisa» se abre y se cierra, y muestra los cambios guardados', () => {
    montar({ fx: { USD: 0.9 }, expenses: [], group: { members: [], expenses: [] } });
    expect(screen.queryByDisplayValue('0.9')).toBeNull();
    fireEvent.press(screen.getByText('Abrir ▼'));
    expect(screen.getByDisplayValue('0.9')).toBeTruthy();
    expect(screen.getByText(/Última actualización online/)).toBeTruthy();
    fireEvent.press(screen.getByText('Cerrar ▲'));
    expect(screen.queryByDisplayValue('0.9')).toBeNull();
  });

  test('editar un cambio a mano lo guarda en el viaje', () => {
    const update = montar({ fx: { USD: 0.9 }, expenses: [], group: { members: [], expenses: [] } });
    fireEvent.press(screen.getByText('Abrir ▼'));
    const campo = screen.getByDisplayValue('0.9');
    fireEvent.changeText(campo, '0,95');
    fireEvent(campo, 'submitEditing');
    expect(update).toHaveBeenCalledWith({ fx: expect.objectContaining({ USD: 0.95 }) });
  });
});

describe('Gastos: gasto en grupo con cifras exactas', () => {
  const trip = (m = miembros2) => ({ expenses: [], group: { members: m, expenses: [] } });

  test('sin al menos 2 participantes pide añadirlos', () => {
    montar({ expenses: [], group: { members: [miembros2[0]], expenses: [] } });
    expect(screen.getByText(/Añade al menos 2 participantes/)).toBeTruthy();
  });

  test('hay que elegir quién ha pagado', () => {
    const update = montar(trip());
    fireEvent.changeText(importes()[1], '90');
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    expect(aviso('Elige quién ha pagado')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  test('por igual: reparte entre todos y vincula el gasto al grupo', () => {
    const update = montar(trip());
    fireEvent.changeText(importes()[1], '90');
    fireEvent.press(screen.getAllByText('Ana')[0]);   // «Pagado por»
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    const patch = update.mock.calls[0][0];
    const [g] = patch.group.expenses;
    expect(g).toMatchObject({ amount: 90, paidBy: 'm1', participants: ['m1', 'm2'] });
    expect(g.shares).toBeUndefined();
    expect(patch.expenses[0]).toMatchObject({ amount: 90, groupId: g.id });
    expect(g.expenseId).toBe(patch.expenses[0].id);
  });

  test('cifras exactas que suman el total se guardan tal cual', () => {
    const update = montar(trip());
    fireEvent.changeText(importes()[1], '90');
    fireEvent.press(screen.getAllByText('Ana')[0]);
    fireEvent.press(screen.getByText('Cifras exactas'));
    const partes = screen.getAllByPlaceholderText('0.00');
    fireEvent.changeText(partes[0], '60');
    fireEvent.changeText(partes[1], '30');
    expect(screen.getByText('✔ Repartido: 90.00 €')).toBeTruthy();
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    const [g] = update.mock.calls[0][0].group.expenses;
    expect(g).toMatchObject({ amount: 90, paidBy: 'm1', shares: { m1: 60, m2: 30 } });
  });

  test('si las cifras no suman el total avisa de lo que falta o sobra y no guarda', () => {
    const update = montar(trip());
    fireEvent.changeText(importes()[1], '90');
    fireEvent.press(screen.getAllByText('Ana')[0]);
    fireEvent.press(screen.getByText('Cifras exactas'));
    const partes = screen.getAllByPlaceholderText('0.00');
    fireEvent.changeText(partes[0], '60');
    fireEvent.changeText(partes[1], '20');
    expect(screen.getByText('Faltan 10.00 € por repartir (80.00 € de 90.00 €)')).toBeTruthy();
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    expect(aviso('Reparto no válido')[1]).toBe('Las cifras suman 80.00 € y el gasto es de 90.00 €.');
    expect(update).not.toHaveBeenCalled();
    fireEvent.changeText(partes[1], '40');
    expect(screen.getByText('Te pasas 10.00 € (100.00 € de 90.00 €)')).toBeTruthy();
  });

  test('cifras negativas o todas vacías se rechazan', () => {
    const update = montar(trip());
    fireEvent.changeText(importes()[1], '90');
    fireEvent.press(screen.getAllByText('Ana')[0]);
    fireEvent.press(screen.getByText('Cifras exactas'));
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    expect(aviso('Reparto no válido')[1]).toBe('Indica cuánto corresponde a cada persona.');
    const partes = screen.getAllByPlaceholderText('0.00');
    fireEvent.changeText(partes[0], '-10');
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    expect(aviso('Reparto no válido')[1]).toBe('Los importes no pueden ser negativos.');
    expect(update).not.toHaveBeenCalled();
  });

  test('«Rellenar a partes iguales» no pierde céntimos (10 € entre 3 = 3,33 + 3,33 + 3,34)', () => {
    const update = montar(trip(miembros3));
    fireEvent.changeText(importes()[1], '10');
    fireEvent.press(screen.getAllByText('Ana')[0]);
    fireEvent.press(screen.getByText('Cifras exactas'));
    fireEvent.press(screen.getByText('Rellenar a partes iguales'));
    expect(screen.getByText('✔ Repartido: 10.00 €')).toBeTruthy();
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    const [g] = update.mock.calls[0][0].group.expenses;
    expect(g.shares).toEqual({ m1: 3.33, m2: 3.33, m3: 3.34 });
    expect(Object.values(g.shares).reduce((a, v) => a + v, 0)).toBeCloseTo(10, 2);
  });

  test('con «Para quién» solo reparte entre los elegidos', () => {
    const update = montar(trip(miembros3));
    fireEvent.changeText(importes()[1], '30');
    fireEvent.press(screen.getAllByText('Ana')[0]);       // Pagado por Ana
    fireEvent.press(screen.getAllByText('Luis')[1]);      // Para quién: Luis
    fireEvent.press(screen.getAllByText('Eva')[1]);       // y Eva
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    expect(update.mock.calls[0][0].group.expenses[0].participants).toEqual(['m2', 'm3']);
  });

  test('en USD el reparto se hace sobre el importe ya convertido a euros', () => {
    const update = montar({ ...trip(), fx: { USD: 0.9 } });
    fireEvent.changeText(importes()[1], '100');
    fireEvent.press(screen.getAllByText('USD')[1]);       // selector de divisa del gasto en grupo
    fireEvent.press(screen.getAllByText('Ana')[0]);
    fireEvent.press(screen.getByText('Cifras exactas'));
    expect(screen.getByText(/Tiene que sumar el importe total \(90.00 €\)/)).toBeTruthy();
    const partes = screen.getAllByPlaceholderText('0.00');
    fireEvent.changeText(partes[0], '45');
    fireEvent.changeText(partes[1], '45');
    fireEvent.press(screen.getByText('Añadir gasto en grupo'));
    const patch = update.mock.calls[0][0];
    expect(patch.group.expenses[0]).toMatchObject({ amount: 90, shares: { m1: 45, m2: 45 } });
    expect(patch.expenses[0].orig).toEqual({ amount: 100, currency: 'USD', rate: 0.9 });
  });
});
