// Enlaces externos: abrir sin que un fallo cierre la app, validar enlaces de Google Maps
// y construir el enlace de Google Maps de una ruta.
import { Linking } from 'react-native';
import { notify } from './components/ui';
import { googleMapsRouteUrl } from './utils';

// Abre un enlace externo (la app si está instalada, si no el navegador). Nunca lanza.
export async function openExternal(url) {
  try { await Linking.openURL(url); } catch (e) { notify('No se pudo abrir el enlace'); }
}

// ¿Es un enlace de Google Maps? (google.com/maps, maps.google.*, goo.gl/maps, maps.app.goo.gl)
export const isMapsLink = (u) => /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(String(u || '').trim());

// Enlace a Google Maps de una ruta: el guardado por el usuario o, si no hay, la ruta entre origen y destino
export const routeMapsUrl = (r) => {
  if (r.mapUrl) return r.mapUrl;
  if (r.from && r.to) return `https://www.google.com/maps/dir/?api=1&origin=${r.from.lat},${r.from.lon}&destination=${r.to.lat},${r.to.lon}&travelmode=transit`;
  return googleMapsRouteUrl(r.origin, r.destination, r.stops, r.mode);
};
