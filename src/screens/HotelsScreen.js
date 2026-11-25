import React, { useState } from 'react';
import { ScrollView, View, Text, Linking } from 'react-native';
import { Card, H, Field, Btn, Row, LinkText, Muted, confirm } from '../components/ui';
import { uid } from '../store';
import { money, num, datesBetween, formatDate, bookingSearchUrl, googleMapsPlaceUrl } from '../utils';

const empty = { city: '', name: '', address: '', checkIn: '', checkOut: '', checkInTime: '15:00', pricePerNight: '', peoplePerRoom: '2', rooms: '1', bookingUrl: '' };

export default function HotelsScreen({ trip, update }) {
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const hotels = trip.hotels || [];

  const searchBooking = () => Linking.openURL(bookingSearchUrl({
    city: form.city, checkIn: form.checkIn, checkOut: form.checkOut,
    adults: num(form.peoplePerRoom) * num(form.rooms) || undefined, rooms: num(form.rooms) || undefined,
  }));

  const save = () => {
    if (!form.name || !form.city) return;
    const h = { ...form, pricePerNight: num(form.pricePerNight), peoplePerRoom: num(form.peoplePerRoom) || 1, rooms: num(form.rooms) || 1 };
    const list = form.id ? hotels.map((x) => (x.id === form.id ? h : x)) : [...hotels, { ...h, id: uid() }];
    list.sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
    update({ hotels: list });
    setForm(null);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      {!form && <Btn title="+ Añadir hotel" onPress={() => setForm(empty)} />}

      {form && (
        <Card>
          <H>{form.id ? 'Editar hotel' : 'Buscar y añadir hotel'}</H>
          <Field label="Ciudad *" value={form.city} onChangeText={(v) => set('city', v)} placeholder="Roma" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Entrada (AAAA-MM-DD)" value={form.checkIn} onChangeText={(v) => set('checkIn', v)} placeholder="2026-07-01" /></View>
            <View style={{ flex: 1 }}><Field label="Salida (AAAA-MM-DD)" value={form.checkOut} onChangeText={(v) => set('checkOut', v)} placeholder="2026-07-04" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Personas/habitación" value={form.peoplePerRoom} onChangeText={(v) => set('peoplePerRoom', v)} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Nº habitaciones" value={form.rooms} onChangeText={(v) => set('rooms', v)} keyboardType="number-pad" /></View>
          </View>
          <Btn title="🔎 Buscar en Booking.com" kind="ok" onPress={searchBooking} />
          <Muted style={{ marginBottom: 8 }}>Elige el hotel en Booking, copia su enlace y pégalo abajo con el precio.</Muted>
          <Field label="Nombre del hotel *" value={form.name} onChangeText={(v) => set('name', v)} />
          <Field label="Dirección (para Google Maps)" value={form.address} onChangeText={(v) => set('address', v)} />
          <Field label="Enlace de Booking del hotel" value={form.bookingUrl} onChangeText={(v) => set('bookingUrl', v)} autoCapitalize="none" placeholder="https://www.booking.com/hotel/..." />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Precio/noche por habitación (€)" value={String(form.pricePerNight)} onChangeText={(v) => set('pricePerNight', v)} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Hora check-in" value={form.checkInTime} onChangeText={(v) => set('checkInTime', v)} /></View>
          </View>
          <Btn title="Guardar hotel" onPress={save} />
          <Btn title="Cancelar" kind="outline" onPress={() => setForm(null)} />
        </Card>
      )}

      {hotels.map((h) => {
        const nights = datesBetween(h.checkIn, h.checkOut);
        const people = h.peoplePerRoom * h.rooms;
        const perNightTotal = h.pricePerNight * h.rooms;
        const total = perNightTotal * nights.length;
        return (
          <Card key={h.id}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{h.name}</Text>
            <Muted>{h.city}{h.address ? ` · ${h.address}` : ''}</Muted>
            <Row label="Hora check-in" value={h.checkInTime || '-'} />
            <Row label="Personas por habitación" value={h.peoplePerRoom} />
            <Row label="Nº habitaciones" value={h.rooms} />
            <Row label="Precio por noche (habitación)" value={money(h.pricePerNight)} />
            <Row label="Precio por persona / noche" value={money(perNightTotal / people)} />
            <Row label="Precio por persona (estancia)" value={money(total / people)} />
            <Row label={`Total (${nights.length} noches)`} value={money(total)} />
            <Text style={{ marginTop: 6, fontWeight: '600' }}>Días de estancia</Text>
            {nights.length ? nights.map((d) => <Muted key={d}>• {formatDate(d)} ({d}) — {money(perNightTotal)}</Muted>) : <Muted>Indica fechas de entrada y salida</Muted>}
            {h.bookingUrl ? <LinkText url={h.bookingUrl}>Ver en Booking.com</LinkText>
              : <LinkText url={bookingSearchUrl({ city: `${h.name} ${h.city}`, checkIn: h.checkIn, checkOut: h.checkOut })}>Buscar en Booking.com</LinkText>}
            <LinkText url={googleMapsPlaceUrl(`${h.name} ${h.address || ''} ${h.city}`)}>Ver en Google Maps</LinkText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn small title="Editar" kind="outline" style={{ flex: 1 }} onPress={() => setForm({ ...h, pricePerNight: String(h.pricePerNight), peoplePerRoom: String(h.peoplePerRoom), rooms: String(h.rooms) })} />
              <Btn small title="Eliminar" kind="danger" style={{ flex: 1 }} onPress={() => confirm('¿Eliminar hotel?', () => update({ hotels: hotels.filter((x) => x.id !== h.id) }))} />
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}
