// Campo para elegir un lugar BUSCÁNDOLO por texto con el geocoding de Transitous.
// No busca mientras se escribe (para no hacer peticiones de más): hay que pulsar "Buscar" o Intro.
// Si Transitous falla, el texto escrito se conserva y la ruta se puede rellenar a mano.
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Btn, Field, Label, Muted, Text, useTheme } from './ui';
import { geocode, errorMessage } from '../transitous';

export default function PlaceSearch({ label, text, onText, place, onPick }) {
  const { colors } = useTheme();
  const [results, setResults] = useState(null); // null = aún no se ha buscado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (loading) return;
    setError('');
    if (String(text || '').trim().length < 2) { setError('Escribe al menos 2 letras.'); return; }
    setLoading(true);
    try {
      setResults(await geocode(text));
    } catch (e) {
      setResults(null);
      setError(`${errorMessage(e)} Puedes escribir el lugar a mano y rellenar los datos a mano.`);
    } finally { setLoading(false); }
  };

  const choose = (p) => { onPick(p); onText(p.name); setResults(null); setError(''); };

  return (
    <View style={{ marginBottom: 4 }}>
      <Field label={label} value={text} onChangeText={(v) => { onText(v); if (place) onPick(null); }} placeholder="Ej. Madrid Atocha" returnKeyType="search" onSubmitEditing={search} />
      {place ? (
        <Muted>✔ {place.name}{place.place ? ` · ${place.place}` : ''}</Muted>
      ) : (
        <Btn small kind="outline" title={loading ? 'Buscando…' : '🔎 Buscar lugar'} onPress={search} />
      )}
      {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
      {!place && results && results.length === 0 ? <Muted>No se han encontrado lugares. Prueba con otro nombre.</Muted> : null}
      {!place && results && results.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 6 }}>
          <Label> Elige uno:</Label>
          {results.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => choose(p)} style={{ paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontWeight: '600' }}>{p.name}</Text>
              {p.place ? <Muted>{p.place}</Muted> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
