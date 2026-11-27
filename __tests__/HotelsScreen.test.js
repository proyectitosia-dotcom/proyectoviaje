// Pantalla Hoteles: el gasto automático en Gastos es lo que paga UNA persona por la estancia.
import React from 'react';
import { Alert, Modal, TextInput } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import HotelsScreen from '../src/screens/HotelsScreen';

const hotel = {
  id: 'h1', name: 'Hotel Sol', city: 'Roma', address: '', checkIn: '2026-12-01', checkOut: '2026-12-04',
  checkInTime: '15:00', pricePerNight: 100, peoplePerRoom: 2, rooms: 2, bookingUrl: '', mapsUrl: '',
};

afterEach(() => jest.restoreAllMocks());

const montar = (trip) => {
  const update = jest.fn();
  render(<HotelsScreen trip={{ fxAt: Date.now(), ...trip }} update={update} />);
  return update;
};

describe('HotelsScreen: gasto automático por persona', () => {
  test('al guardar: 100 €/noche × 3 noches ÷ 2 personas = 150 € (no el total de 600 €)', () => {
    const update = montar({ hotels: [hotel], expenses: [] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][0];
    expect(patch.expenses).toHaveLength(1);
    expect(patch.expenses[0]).toMatchObject({ category: 'hoteles', amount: 150, hotelId: 'h1', date: '2026-12-01', concept: 'Hotel Hotel Sol (por persona)' });
  });

  test('el importe no depende del número de habitaciones', () => {
    const update = montar({ hotels: [{ ...hotel, rooms: 5 }], expenses: [] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(update.mock.calls[0][0].expenses[0].amount).toBe(150);
  });

  test('con 1 persona por habitación paga la estancia completa de una habitación', () => {
    const update = montar({ hotels: [{ ...hotel, peoplePerRoom: 1 }], expenses: [] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(update.mock.calls[0][0].expenses[0].amount).toBe(300);
  });

  test('al editar el hotel se actualiza el mismo gasto (mismo id) y el del grupo vinculado', () => {
    const gasto = { id: 'g1', category: 'hoteles', concept: 'Hotel Hotel Sol', amount: 600, date: '2026-12-01', hotelId: 'h1', groupId: 'gg1' };
    const trip = { hotels: [hotel], expenses: [gasto, { id: 'otro', category: 'comida', amount: 20 }], group: { members: [], expenses: [{ id: 'gg1', amount: 600, concept: 'Hotel Hotel Sol', date: '2026-12-01' }] } };
    const update = montar(trip);
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Guardar hotel'));
    const patch = update.mock.calls[0][0];
    expect(patch.expenses.filter((e) => e.hotelId === 'h1')).toHaveLength(1);
    expect(patch.expenses.find((e) => e.hotelId === 'h1')).toMatchObject({ id: 'g1', amount: 150, groupId: 'gg1' });
    expect(patch.expenses.find((e) => e.id === 'otro')).toBeTruthy();
    expect(patch.group.expenses[0]).toMatchObject({ id: 'gg1', amount: 150, concept: 'Hotel Hotel Sol (por persona)' });
  });

  test('sin precio no se crea gasto y se quita el que había', () => {
    const gasto = { id: 'g1', category: 'hoteles', amount: 150, hotelId: 'h1' };
    const update = montar({ hotels: [{ ...hotel, pricePerNight: 0 }], expenses: [gasto] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(update.mock.calls[0][0].expenses).toEqual([]);
  });

  test('eliminar el hotel quita su gasto', () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation((t, m, botones) => botones.find((b) => b.text === 'Sí').onPress());
    const gasto = { id: 'g1', category: 'hoteles', amount: 150, hotelId: 'h1' };
    const update = montar({ hotels: [hotel], expenses: [gasto] });
    fireEvent.press(screen.getByText('Eliminar'));
    expect(alerta).toHaveBeenCalled();
    expect(update.mock.calls[0][0]).toMatchObject({ hotels: [], expenses: [] });
  });

  test('el resumen del hotel muestra el precio por persona de la estancia (150,00 €)', () => {
    montar({ hotels: [hotel], expenses: [] });
    expect(screen.getByText('150.00 €')).toBeTruthy();   // por persona (estancia)
    expect(screen.getByText('600.00 €')).toBeTruthy();   // total de todos
  });
});

describe('HotelsScreen: fechas y ventana flotante de edición', () => {
  test('la fila «Fechas» de la tarjeta muestra dd-mm-aaaa', () => {
    montar({ hotels: [hotel], expenses: [] });
    expect(screen.getByText('01-12-2026 → 04-12-2026')).toBeTruthy();
    expect(screen.queryByText('2026-12-01 → 2026-12-04')).toBeNull();
  });

  test('«Editar» abre el formulario en un Modal y se cierra al guardar', () => {
    montar({ hotels: [hotel], expenses: [] });
    expect(screen.UNSAFE_queryAllByType(Modal).some((m) => m.props.visible)).toBe(false);
    fireEvent.press(screen.getByText('Editar'));
    expect(screen.getByText('Editar hotel')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(Modal).some((m) => m.props.visible)).toBe(true);
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(screen.queryByText('Editar hotel')).toBeNull();
    expect(screen.UNSAFE_queryAllByType(Modal).some((m) => m.props.visible)).toBe(false);
  });

  test('«Cancelar» cierra la ventana sin guardar', () => {
    const update = montar({ hotels: [hotel], expenses: [] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Editar hotel')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  test('«+ Añadir hotel» sigue en línea (sin Modal) y se puede cancelar', () => {
    montar({ hotels: [], expenses: [] });
    fireEvent.press(screen.getByText('+ Añadir hotel'));
    expect(screen.getByText('Buscar y añadir hotel')).toBeTruthy();
    // Hay Modals ocultos (selector de fechas, navegador de Booking), pero ninguno visible: el formulario va en línea
    expect(screen.UNSAFE_queryAllByType(Modal).some((m) => m.props.visible)).toBe(false);
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Buscar y añadir hotel')).toBeNull();
  });

  test('guardar un hotel nuevo sin nombre ni ciudad no actualiza nada', () => {
    const update = montar({ hotels: [], expenses: [] });
    fireEvent.press(screen.getByText('+ Añadir hotel'));
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(update).not.toHaveBeenCalled();
  });
});

describe('HotelsScreen: divisa del precio por noche', () => {
  const precio = () => screen.UNSAFE_getAllByType(TextInput).filter((t) => t.props.keyboardType === 'decimal-pad')[0];
  const editarYGuardar = () => { fireEvent.press(screen.getByText('Editar')); };
  const guardado = (update) => update.mock.calls[0][0].hotels[0];

  test('en euros: sin «priceOrig» ni «currency» y el gasto por persona no cambia (150 €)', () => {
    const update = montar({ hotels: [hotel], expenses: [] });
    editarYGuardar();
    fireEvent.press(screen.getByText('Guardar hotel'));
    const h = guardado(update);
    expect(h.pricePerNight).toBe(100);
    expect('priceOrig' in h).toBe(false);
    expect('currency' in h).toBe(false);
    expect(update.mock.calls[0][0].expenses[0].amount).toBe(150);
  });

  test('en USD: pricePerNight en euros, original en «priceOrig» y gasto por persona en euros', () => {
    const update = montar({ fx: { USD: 0.9 }, hotels: [hotel], expenses: [] });
    editarYGuardar();
    fireEvent.press(screen.getByText('USD'));                  // el 100 escrito pasa a ser 100 USD
    expect(screen.getByText('Precio/noche por habitación (USD)')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar hotel'));
    const h = guardado(update);
    expect(h.pricePerNight).toBe(90);
    expect(h.priceOrig).toEqual({ amount: 100, currency: 'USD', rate: 0.9 });
    expect('currency' in h).toBe(false);
    expect(update.mock.calls[0][0].expenses[0].amount).toBe(135);   // 90 € × 3 noches ÷ 2 personas
  });

  test('la vista previa por persona y noche se calcula en euros (100 USD ÷ 2 = 45 €)', () => {
    montar({ fx: { USD: 0.9 }, hotels: [hotel], expenses: [] });
    editarYGuardar();
    fireEvent.press(screen.getByText('USD'));
    expect(screen.getByText(/≈ 45\.00 € por persona y noche/)).toBeTruthy();
    expect(screen.getByText('≈ 90.00 € (1 USD = 0.9 €)')).toBeTruthy();
  });

  test('la tarjeta muestra «100.00 € (110 USD)» y en euros sin paréntesis', () => {
    montar({ hotels: [{ ...hotel, pricePerNight: 100, priceOrig: { amount: 110, currency: 'USD', rate: 0.909 } }], expenses: [] });
    expect(screen.getByText('100.00 € (110 USD)')).toBeTruthy();
  });

  test('en euros la tarjeta no lleva paréntesis', () => {
    montar({ hotels: [hotel], expenses: [] });
    expect(screen.getByText('100.00 €')).toBeTruthy();
  });

  test('al editar recupera el importe y la divisa originales', () => {
    montar({ fx: { USD: 0.9 }, hotels: [{ ...hotel, pricePerNight: 99, priceOrig: { amount: 110, currency: 'USD', rate: 0.9 } }], expenses: [] });
    editarYGuardar();
    expect(screen.getByDisplayValue('110')).toBeTruthy();
    expect(screen.getByText('Precio/noche por habitación (USD)')).toBeTruthy();
  });

  test('al pasar a euros al editar desaparece «priceOrig»', () => {
    const update = montar({ fx: { USD: 0.9 }, hotels: [{ ...hotel, pricePerNight: 99, priceOrig: { amount: 110, currency: 'USD', rate: 0.9 } }], expenses: [] });
    editarYGuardar();
    fireEvent.press(screen.getByText('EUR'));
    fireEvent.press(screen.getByText('Guardar hotel'));
    const h = guardado(update);
    expect(h.pricePerNight).toBe(110);
    expect('priceOrig' in h).toBe(false);
  });

  test('un precio negativo no se guarda y uno vacío da 0 (sin gasto)', () => {
    const update = montar({ hotels: [hotel], expenses: [] });
    editarYGuardar();
    fireEvent.changeText(precio(), '-5');
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(update).not.toHaveBeenCalled();
    fireEvent.changeText(precio(), '');
    fireEvent.press(screen.getByText('Guardar hotel'));
    expect(guardado(update).pricePerNight).toBe(0);
    expect(update.mock.calls[0][0].expenses).toBeUndefined();   // sin precio no hay gasto que crear
  });

  test('con cambios caducados se descargan al abrir Hoteles (BCE simulado) y se guardan en el viaje', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rates: { USD: 1.25, GBP: 0.8, JPY: 160, CHF: 0.95, CAD: 1.5, AUD: 1.6, MXN: 20, CNY: 7.8 } }) });
    const update = jest.fn();
    render(<HotelsScreen trip={{ hotels: [], expenses: [], fx: {}, fxAt: Date.now() - 2 * 3600 * 1000 }} update={update} />);
    await waitFor(() => expect(update).toHaveBeenCalledWith({ fx: expect.objectContaining({ USD: 0.8 }), fxAt: expect.any(Number) }));
  });

  test('con cambios recientes no hay ninguna petición al abrir Hoteles', () => {
    montar({ hotels: [], expenses: [] });
    expect(fetch).not.toHaveBeenCalled();
  });
});
