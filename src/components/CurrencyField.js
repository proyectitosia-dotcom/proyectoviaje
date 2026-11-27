// Selector de divisa + vista previa de la conversión a euros. Se usa debajo del campo «Importe» (Gastos, Ruta, Hoteles…).
// `rates` es lo que devuelve useRates() de src/currency.js.
import React from 'react';
import { View } from 'react-native';
import { Chip, Label, Muted } from './ui';
import { CURRENCIES } from '../currency';
import { money } from '../utils';

export default function CurrencyField({ currency, amount, rates, onChange, label = 'Divisa del importe' }) {
  return (
    <View>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CURRENCIES.map(([c]) => <Chip key={c} title={c} active={currency === c} onPress={() => { onChange(c); if (c !== 'EUR') rates.ensureFresh(); }} />)}
      </View>
      {currency !== 'EUR' && <Muted>≈ {money(rates.convert(amount, currency).eur)} (1 {currency} = {rates.rateOf(currency)} €)</Muted>}
    </View>
  );
}
