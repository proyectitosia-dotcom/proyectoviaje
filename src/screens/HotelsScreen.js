import React, { useState } from 'react';
import { ScrollView, View, Linking, Platform } from 'react-native';
import { Card, H, Field, Btn, Row, LinkText, Muted, confirm, notify , Text, DateField } from '../components/ui';
import { uid } from '../store';
import BookingBrowser from '../components/BookingBrowser';
import { money, num, addDays, datesBetween, formatDate, fmtDMY, bookingSearchUrl, googleMapsPlaceUrl } from '../utils';

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && addDays(s, 0) === s;
const normUrl = (u) => { const t = (u || '').trim(); return !t ? '' : /^https?:\/\//i.test(t) ? t : `https://${t}`; };

const empty = { city: '', name: '', address: '', checkIn: '', checkOut: '', checkInTime: '15:00', pricePerNight: '', peoplePerRoom: '2', rooms: '1', bookingUrl: '', mapsUrl: '' };

const mapsFor = (h) => (h.lat && h.lng ? `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}` : googleMapsPlaceUrl([h.name, h.address, h.city].filter(Boolean).join(' ')));

export default function HotelsScreen({ trip, update }) {
  const [form, setForm] = useState(null);
  const [browserUrl, setBrowserUrl] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const hotels = trip.hotels || [];

  const searchBooking = () => {
    const city = (form.city || '').trim();
    if (!city) return notify('Falta la ciudad', 'Indica la ciudad para buscar en Booking.');
    const ci = (form.checkIn || '').trim(), co = (form.checkOut || '').trim();
    const okDates = isDate(ci) && isDate(co) && co > ci;
    if (ci || co) {
      if (!okDates) notify('Fechas no válidas', 'Se buscará sin fechas. La salida debe ser posterior a la entrada.');
    }
    const rooms = Math.max(1, Math.round(num(form.rooms)) || 1);
    const adults = Math.max(1, Math.round(num(form.peoplePerRoom)) || 1) * rooms;
    const url = bookingSearchUrl({ city, checkIn: okDates ? ci : undefined, checkOut: okDates ? co : undefined, adults, rooms });
    if (Platform.OS === 'web') Linking.openURL(url); // Booking no se puede incrustar en web
    else setBrowserUrl(url);
  };

  // Hotel elegido dentro del navegador de Booking: rellena nombre, enlaces de Booking y de Maps
  // El precio que muestra Booking es el de la estancia (todas las noches y habitaciones): se divide para sacar el precio por noche y habitación
  const pickHotel = (d) => {
    setForm((f) => {
      const nn = datesBetween(f.checkIn, f.checkOut).length;
      const rm = Math.max(1, Math.round(num(f.rooms)) || 1);
      const perNight = d.price ? Math.round((d.price / Math.max(1, nn) / rm) * 100) / 100 : null;
      const n = { ...f, name: d.name || f.name, address: d.address || f.address, city: f.city || d.city || '', bookingUrl: d.url, lat: d.lat, lng: d.lng, ...(perNight ? { pricePerNight: String(perNight) } : {}) };
      return { ...n, mapsUrl: mapsFor(n) };
    });
    setBrowserUrl(null);
  };

  // Mantiene el gasto del hotel (categoría Hoteles) sincronizado con su coste total; conserva su vínculo con el grupo
  const hotelExpensePatch = (hid, h) => {
    const expenses = trip.expenses || [];
    const group = trip.group || { members: [], expenses: [] };
    const old = expenses.find((e) => e.hotelId === hid);
    const rest = expenses.filter((e) => e.hotelId !== hid);
    const amount = h ? Math.round((Number(h.pricePerNight) || 0) * Math.max(1, Number(h.rooms) || 1) * datesBetween(h.checkIn, h.checkOut).length * 100) / 100 : 0;
    if (!(amount > 0)) {
      if (!old) return {};
      return { expenses: rest, ...(old.groupId ? { group: { ...group, expenses: (group.expenses || []).filter((g) => g.id !== old.groupId) } } : {}) };
    }
    const next = { id: old ? old.id : uid(), category: 'hoteles', concept: `Hotel ${h.name}`, amount, date: h.checkIn || '', hotelId: hid, ...(old && old.groupId ? { groupId: old.groupId } : {}) };
    const patch = { expenses: [...rest, next] };
    if (old && old.groupId) patch.group = { ...group, expenses: (group.expenses || []).map((g) => (g.id === old.groupId ? { ...g, amount, concept: next.concept, date: next.date } : g)) };
    return patch;
  };

  const save = () => {
    const name = (form.name || '').trim(), city = (form.city || '').trim();
    if (!name || !city) return notify('Faltan datos', 'El nombre del hotel y la ciudad son obligatorios.');
    const ci = (form.checkIn || '').trim(), co = (form.checkOut || '').trim();
    if (ci && !isDate(ci)) return notify('Fecha de entrada no válida', 'Elige la fecha en el calendario.');
    if (co && !isDate(co)) return notify('Fecha de salida no válida', 'Elige la fecha en el calendario.');
    if ((ci && !co) || (!ci && co)) return notify('Faltan fechas', 'Indica tanto la entrada como la salida.');
    if (ci && co && co <= ci) return notify('Fechas incorrectas', 'La fecha de salida debe ser posterior a la de entrada.');
    const price = num(form.pricePerNight);
    if (price < 0) return notify('Precio no válido', 'El precio no puede ser negativo.');
    const h = {
      ...form, name, city, checkIn: ci, checkOut: co, bookingUrl: normUrl(form.bookingUrl), pricePerNight: price,
      mapsUrl: form.mapsUrl || mapsFor({ name, address: form.address, city, lat: form.lat, lng: form.lng }),
      peoplePerRoom: Math.max(1, Math.round(num(form.peoplePerRoom)) || 1), rooms: Math.max(1, Math.round(num(form.rooms)) || 1),
    };
    const hid = form.id || uid();
    const list = form.id ? hotels.map((x) => (x.id === form.id ? h : x)) : [...hotels, { ...h, id: hid }];
    list.sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
    update({ hotels: list, ...hotelExpensePatch(hid, { ...h, id: hid }) });
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
            <View style={{ flex: 1 }}><DateField label="Entrada" value={form.checkIn} onChange={(v) => set('checkIn', v)} /></View>
            <View style={{ flex: 1 }}><DateField label="Salida" value={form.checkOut} onChange={(v) => set('checkOut', v)} /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Personas/habitación" value={form.peoplePerRoom} onChangeText={(v) => set('peoplePerRoom', v)} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Nº habitaciones" value={form.rooms} onChangeText={(v) => set('rooms', v)} keyboardType="number-pad" /></View>
          </View>
          <Btn title="🔎 Buscar en Booking.com" kind="ok" onPress={searchBooking} />
          <Muted style={{ marginBottom: 8 }}>{Platform.OS === 'web' ? 'Booking se abre en otra pestaña (no se puede incrustar en web): copia el enlace del hotel y pégalo abajo.' : 'Abre un hotel en Booking y pulsa «Usar este hotel»: se rellenan nombre, dirección y los enlaces de Booking y Maps.'}</Muted>
          <Field label="Nombre del hotel *" value={form.name} onChangeText={(v) => set('name', v)} />
          <Field label="Dirección (para Google Maps)" value={form.address} onChangeText={(v) => set('address', v)} />
          <Field label="Enlace de Booking del hotel" value={form.bookingUrl} onChangeText={(v) => set('bookingUrl', v)} autoCapitalize="none" placeholder="https://www.booking.com/hotel/..." />
          {num(form.pricePerNight) > 0 ? <Muted>≈ {money(num(form.pricePerNight) * Math.max(1, num(form.rooms) || 1) / Math.max(1, (num(form.peoplePerRoom) || 1) * Math.max(1, num(form.rooms) || 1)))} por persona y noche · se añade a Gastos › Hoteles al guardar</Muted> : null}
          <LinkText url={form.mapsUrl || mapsFor(form)}>📍 Enlace de Google Maps (automático)</LinkText>
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
        const rooms = Math.max(1, Number(h.rooms) || 1);
        const people = Math.max(1, (Number(h.peoplePerRoom) || 1) * rooms);
        const perNightTotal = (Number(h.pricePerNight) || 0) * rooms;
        const total = perNightTotal * nights.length;
        const bookingHref = normUrl(h.bookingUrl);
        return (
          <Card key={h.id}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{h.name}</Text>
            <Muted>{h.city}{h.address ? ` · ${h.address}` : ''}</Muted>
            <Row label="Hora check-in" value={h.checkInTime || '-'} />
            {h.checkIn && h.checkOut ? <Row label="Fechas" value={`${h.checkIn} → ${h.checkOut}`} /> : null}
            <Row label="Personas por habitación" value={h.peoplePerRoom} />
            <Row label="Nº habitaciones" value={h.rooms} />
            <Row label="Precio por noche (habitación)" value={money(h.pricePerNight)} />
            <Row label="Precio por persona / noche" value={money(perNightTotal / people)} />
            <Row label="Precio por persona (estancia)" value={money(total / people)} />
            <Row label={`Total (${nights.length} ${nights.length === 1 ? 'noche' : 'noches'})`} value={money(total)} />
            <Text style={{ marginTop: 6, fontWeight: '600' }}>Días de estancia</Text>
            {nights.length ? nights.map((d) => <Muted key={d}>• {formatDate(d)} ({fmtDMY(d)}) — {money(perNightTotal)}</Muted>) : <Muted>Indica fechas de entrada y salida</Muted>}
            {bookingHref ? <LinkText url={bookingHref}>Ver en Booking.com</LinkText>
              : <LinkText url={bookingSearchUrl({ city: `${h.name} ${h.city}`, checkIn: nights.length ? h.checkIn : undefined, checkOut: nights.length ? h.checkOut : undefined })}>Buscar en Booking.com</LinkText>}
            <LinkText url={h.mapsUrl || mapsFor(h)}>Ver en Google Maps</LinkText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn small title="Editar" kind="outline" style={{ flex: 1 }} onPress={() => setForm({ ...h, pricePerNight: String(h.pricePerNight), peoplePerRoom: String(h.peoplePerRoom), rooms: String(h.rooms) })} />
              <Btn small title="Eliminar" kind="danger" style={{ flex: 1 }} onPress={() => confirm('¿Eliminar hotel? También se quitará su gasto.', () => update({ hotels: hotels.filter((x) => x.id !== h.id), ...hotelExpensePatch(h.id, null) }))} />
            </View>
          </Card>
        );
      })}
      <BookingBrowser visible={!!browserUrl} url={browserUrl} onClose={() => setBrowserUrl(null)} onPick={pickHotel} />
    </ScrollView>
  );
}
