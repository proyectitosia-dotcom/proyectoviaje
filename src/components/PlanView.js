// Muestra un itinerario de Transitous: salida y llegada, duración total, transbordos y cada tramo
// (a pie o en transporte, con su línea).
import React from 'react';
import { View } from 'react-native';
import { Muted, Text, useTheme } from './ui';
import { fmtDur, fmtTime, modeIcon, modeLabel } from '../transitous';

export default function PlanView({ plan, tz, compact }) {
  const { colors } = useTheme();
  if (!plan || !Array.isArray(plan.legs)) return null;
  const zone = tz || plan.tz || '';
  const lines = plan.legs.filter((l) => l.mode !== 'WALK').map((l) => `${modeIcon(l.mode)} ${l.line || modeLabel(l.mode)}`).filter((x, i, a) => a.indexOf(x) === i);
  return (
    <View style={{ marginVertical: 4 }}>
      <Text style={{ fontWeight: '700', fontSize: 16 }}>
        {fmtTime(plan.start, zone)} → {fmtTime(plan.end, zone)} · {fmtDur(plan.durationMin)}
      </Text>
      <Muted>{plan.transfers === 0 ? 'Sin transbordos' : plan.transfers === 1 ? '1 transbordo' : `${plan.transfers} transbordos`}</Muted>
      {/* Nombre de las líneas que se van a usar */}
      {lines.length > 0 ? <Text style={{ fontWeight: '600', marginTop: 4 }}>Líneas: {lines.join('  ·  ')}</Text> : null}
      {plan.legs.map((l, i) => {
        const walk = l.mode === 'WALK';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4, borderTopWidth: i ? 1 : 0, borderColor: colors.border, marginTop: i ? 4 : 6 }}>
            <Text style={{ fontSize: 18 }}>{modeIcon(l.mode)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>
                {walk ? `A pie ${fmtDur(l.durationMin)}${l.distance ? ` (${l.distance} m)` : ''}` : `${modeLabel(l.mode)}${l.line ? ` ${l.line}` : ''}${l.headsign && !compact ? ` → ${l.headsign}` : ''}`}
              </Text>
              <Muted>{fmtTime(l.start, zone)} {l.from}  →  {fmtTime(l.end, zone)} {l.to}</Muted>
              {!walk && l.agency && !compact ? <Muted>{l.agency} · {fmtDur(l.durationMin)}</Muted> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
