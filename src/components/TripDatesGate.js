// Pantalla para elegir la fecha de inicio y de fin del viaje.
//  - Modo obligatorio (sin onCancel): aparece al abrir un viaje que aún no tiene fechas y no se puede saltar.
//  - Modo ajustes (con onCancel): permite cambiar las fechas más tarde.
// Valida que el fin no sea anterior al inicio. Estos dos selectores no tienen restricción de rango
// (son los que definen el rango).
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Btn, Card, DateField, H, Muted, Text, notify } from './ui';
import { isIsoDate } from '../tripRange';
import { fmtDMY } from '../utils';

export default function TripDatesGate({ tripName, initialStart, initialEnd, onSave, onCancel, onExit }) {
  const [start, setStart] = useState(isIsoDate(initialStart) ? initialStart : '');
  const [end, setEnd] = useState(isIsoDate(initialEnd) ? initialEnd : '');
  const mandatory = !onCancel;

  const save = () => {
    if (!start) return notify('Falta la fecha de inicio', 'Elige el día en que empieza el viaje.');
    if (!end) return notify('Falta la fecha de fin', 'Elige el día en que termina el viaje.');
    if (end < start) return notify('Fechas no válidas', `La fecha de fin (${fmtDMY(end)}) no puede ser anterior a la de inicio (${fmtDMY(start)}).`);
    onSave(start, end);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 40 }}>
      <Card>
        <H>{mandatory ? '📅 ¿Cuándo es el viaje?' : '📅 Fechas del viaje'}</H>
        {tripName ? <Text style={{ fontWeight: '700', marginBottom: 4 }}>{tripName}</Text> : null}
        <Muted>
          {mandatory
            ? 'Elige el día de inicio y el de fin. Es obligatorio: todos los calendarios de la app solo permitirán días dentro de este rango.'
            : 'Al cambiarlas, los calendarios de la app solo permitirán días dentro del nuevo rango.'}
        </Muted>
        <View style={{ height: 8 }} />
        <DateField label="Fecha de inicio" value={start} onChange={(v) => { setStart(v); if (end && v && end < v) setEnd(''); }} unrestricted />
        <DateField label="Fecha de fin" value={end} onChange={setEnd} unrestricted min={start || undefined} />
        <Btn title={mandatory ? 'Continuar' : 'Guardar fechas'} onPress={save} />
        {onCancel ? <Btn kind="outline" title="Cancelar" onPress={onCancel} /> : null}
        {onExit ? <Btn kind="outline" small title="‹ Volver a mis viajes" onPress={onExit} /> : null}
      </Card>
    </ScrollView>
  );
}
