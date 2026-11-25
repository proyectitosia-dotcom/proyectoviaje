export const money = (n) => `${(Number(n) || 0).toFixed(2)} €`;
export const num = (s) => {
  const v = parseFloat(String(s ?? '').replace(',', '.'));
  return isNaN(v) ? 0 : v;
};

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function datesBetween(checkIn, checkOut) {
  const out = [];
  let d = checkIn;
  for (let i = 0; d && d < checkOut && i < 365; i++) {
    out.push(d);
    d = addDays(checkIn, i + 1);
  }
  return out;
}

export function formatDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d)) return dateStr || '';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

const enc = encodeURIComponent;

// Google Maps con ruta y paradas ya creada
export function googleMapsRouteUrl(origin, destination, stops = [], mode = 'transit') {
  let url = `https://www.google.com/maps/dir/?api=1&origin=${enc(origin)}&destination=${enc(destination)}&travelmode=${mode}`;
  const wp = stops.filter(Boolean);
  if (wp.length) url += `&waypoints=${enc(wp.join('|'))}`;
  return url;
}

export const googleMapsPlaceUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${enc(query)}`;

// Búsqueda de hoteles en Booking.com por ciudad
export function bookingSearchUrl({ city, checkIn, checkOut, adults, rooms }) {
  let url = `https://www.booking.com/searchresults.es.html?ss=${enc(city)}`;
  if (checkIn) url += `&checkin=${checkIn}`;
  if (checkOut) url += `&checkout=${checkOut}`;
  if (adults) url += `&group_adults=${adults}`;
  if (rooms) url += `&no_rooms=${rooms}`;
  return url;
}

// Cuadre de gastos: devuelve saldos y transferencias mínimas
export function settleUp(members, expenses) {
  const bal = Object.fromEntries(members.map((m) => [m.id, 0]));
  for (const e of expenses) {
    const parts = (e.participants || []).filter((p) => p in bal);
    if (!parts.length || !(e.paidBy in bal)) continue;
    const share = num(e.amount) / parts.length;
    bal[e.paidBy] += num(e.amount);
    parts.forEach((p) => { bal[p] -= share; });
  }
  const debtors = [], creditors = [];
  Object.entries(bal).forEach(([id, v]) => {
    if (v < -0.005) debtors.push({ id, v: -v });
    else if (v > 0.005) creditors.push({ id, v });
  });
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].v -= amt; creditors[j].v -= amt;
    if (debtors[i].v < 0.005) i++;
    if (creditors[j].v < 0.005) j++;
  }
  return { balances: bal, transfers };
}

// Fechas: se guardan como AAAA-MM-DD y se muestran como dd-mm-aaaa
export const fmtDMY = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : iso || '');
export const fmtDM = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}` : '');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
