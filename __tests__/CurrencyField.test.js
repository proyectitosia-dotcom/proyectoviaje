import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import CurrencyField from '../src/components/CurrencyField';

const rates = () => ({ convert: jest.fn(() => ({ eur: 90 })), rateOf: jest.fn(() => 0.9), ensureFresh: jest.fn() });

describe('CurrencyField', () => {
  test('muestra las 9 divisas', () => {
    render(<CurrencyField currency="EUR" amount="" rates={rates()} onChange={jest.fn()} />);
    ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'MXN', 'CNY'].forEach((c) => expect(screen.getByText(c)).toBeTruthy());
  });
  test('en euros no hay vista previa', () => {
    render(<CurrencyField currency="EUR" amount="100" rates={rates()} onChange={jest.fn()} />);
    expect(screen.queryByText(/≈/)).toBeNull();
  });
  test('en otra divisa muestra «≈ X € (1 USD = Y €)»', () => {
    const r = rates();
    render(<CurrencyField currency="USD" amount="100" rates={r} onChange={jest.fn()} />);
    expect(screen.getByText('≈ 90.00 € (1 USD = 0.9 €)')).toBeTruthy();
    expect(r.convert).toHaveBeenCalledWith('100', 'USD');
  });
  test('elegir una divisa avisa y pide cambios al día; el euro no los pide', () => {
    const r = rates(); const onChange = jest.fn();
    render(<CurrencyField currency="EUR" amount="" rates={r} onChange={onChange} />);
    fireEvent.press(screen.getByText('GBP'));
    expect(onChange).toHaveBeenCalledWith('GBP');
    expect(r.ensureFresh).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('EUR'));
    expect(onChange).toHaveBeenLastCalledWith('EUR');
    expect(r.ensureFresh).toHaveBeenCalledTimes(1);
  });
  test('la etiqueta se puede cambiar', () => {
    render(<CurrencyField currency="EUR" amount="" rates={rates()} onChange={jest.fn()} label="Moneda" />);
    expect(screen.getByText('Moneda')).toBeTruthy();
  });
});
