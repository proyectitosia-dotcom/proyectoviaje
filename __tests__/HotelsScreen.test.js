// Pantalla Hoteles: el gasto automático en Gastos es lo que paga UNA persona por la estancia.
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import HotelsScreen from '../src/screens/HotelsScreen';

const hotel = {
  id: 'h1', name: 'Hotel Sol', city: 'Roma', address: '', checkIn: '2026-12-01', checkOut: '2026-12-04',
  checkInTime: '15:00', pricePerNight: 100, peoplePerRoom: 2, rooms: 2, bookingUrl: '', mapsUrl: '',
};

const montar = (trip) => {
  const update = jest.fn();
  render(<HotelsScreen trip={trip} update={update} />);
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
