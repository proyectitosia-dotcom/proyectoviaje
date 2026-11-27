import { Linking } from 'react-native';
import { isMapsLink, routeMapsUrl, openExternal } from '../src/links';
import { notify } from '../src/components/ui';

jest.mock('../src/components/ui', () => ({ notify: jest.fn() }));

describe('links: isMapsLink', () => {
  test.each([
    'https://www.google.com/maps/place/Madrid',
    'http://google.com/maps?q=x',
    'https://www.google.es/maps/dir/A/B',
    'https://maps.google.com/?q=x',
    'https://maps.google.es/?q=x',
    'https://goo.gl/maps/abc123',
    'https://maps.app.goo.gl/abc123',
    '  https://maps.app.goo.gl/abc123  ',
    'HTTPS://WWW.GOOGLE.COM/MAPS',
  ])('reconoce %s', (u) => expect(isMapsLink(u)).toBe(true));

  test.each([
    'https://example.com',
    'https://www.google.com/search?q=maps',
    'https://evil.com/?u=https://google.com/maps',
    'google.com/maps',
    '',
    null,
    undefined,
  ])('rechaza %s', (u) => expect(isMapsLink(u)).toBe(false));
});

describe('links: routeMapsUrl', () => {
  test('usa el enlace guardado por el usuario', () => {
    expect(routeMapsUrl({ mapUrl: 'https://maps.app.goo.gl/xyz', from: { lat: 1, lon: 2 }, to: { lat: 3, lon: 4 } }))
      .toBe('https://maps.app.goo.gl/xyz');
  });
  test('con coordenadas de salida y llegada, ruta en transporte público', () => {
    expect(routeMapsUrl({ from: { lat: 40.4, lon: -3.7 }, to: { lat: 41.38, lon: 2.17 } }))
      .toBe('https://www.google.com/maps/dir/?api=1&origin=40.4,-3.7&destination=41.38,2.17&travelmode=transit');
  });
  test('sin coordenadas usa origen, destino, paradas y modo', () => {
    expect(routeMapsUrl({ origin: 'Madrid', destination: 'Sevilla', stops: ['Córdoba'], mode: 'driving' }))
      .toBe('https://www.google.com/maps/dir/?api=1&origin=Madrid&destination=Sevilla&travelmode=driving&waypoints=C%C3%B3rdoba');
  });
  test('una ruta vacía no falla', () => {
    expect(routeMapsUrl({})).toBe('https://www.google.com/maps/dir/?api=1&origin=&destination=&travelmode=transit');
  });
});

describe('links: openExternal', () => {
  beforeEach(() => notify.mockClear());
  test('abre el enlace', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true);
    await openExternal('https://example.com');
    expect(spy).toHaveBeenCalledWith('https://example.com');
    expect(notify).not.toHaveBeenCalled();
  });
  test('si falla no lanza y avisa al usuario', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('sin app'));
    await expect(openExternal('https://example.com')).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith('No se pudo abrir el enlace');
  });
});
