// Pantalla Gastos: el gasto automático de Hoteles (lo que paga una persona) entra en «Mi total gastado».
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ExpensesScreen from '../src/screens/ExpensesScreen';

describe('ExpensesScreen: gasto automático de hoteles', () => {
  test('«Hoteles del viaje» suma lo que paga una persona (150 €) y entra en el total', async () => {
    const trip = {
      expenses: [{ id: 'g1', category: 'hoteles', concept: 'Hotel Sol (por persona)', amount: 150, date: '2026-12-01', hotelId: 'h1' }],
      group: { members: [], expenses: [] },
      routes: [],
    };
    render(<ExpensesScreen trip={trip} update={jest.fn()} />);
    expect(await screen.findByText('🏨 Hoteles del viaje')).toBeTruthy();
    expect(screen.getAllByText('150.00 €').length).toBeGreaterThanOrEqual(2); // total y categoría
    expect(screen.queryByText('600.00 €')).toBeNull();
  });

  test('sin gastos muestra el aviso de que no hay ninguno', async () => {
    render(<ExpensesScreen trip={{ expenses: [], group: { members: [], expenses: [] }, routes: [] }} update={jest.fn()} />);
    expect(await screen.findByText('Todavía no has añadido gastos.')).toBeTruthy();
  });
});
