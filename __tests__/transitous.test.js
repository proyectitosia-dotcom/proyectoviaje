// Tests de src/transitous.js: todo con fetch mockeado, sin red real.
let T;
let AsyncStorage;

const okJson = (data) => ({ ok: true, status: 200, json: async () => data });
const MADRID = { name: 'Madrid', lat: 40.4168, lon: -3.7038, tz: 'Europe/Madrid' };
const BCN = { name: 'Barcelona', lat: 41.3851, lon: 2.1734, tz: 'Europe/Madrid' };

const leg = (over = {}) => ({
  mode: 'HIGHSPEED_RAIL',
  from: { name: 'START', lat: 40.4, lon: -3.7 },
  to: { name: 'Barcelona Sants', lat: 41.37, lon: 2.14 },
  startTime: '2026-12-01T08:00:00Z',
  endTime: '2026-12-01T10:30:00Z',
  duration: 9000,
  distance: 620000.4,
  routeShortName: 'AVE',
  headsign: 'Barcelona',
  agencyName: 'Renfe',
  ...over,
});
const itinerary = (start, over = {}) => ({
  startTime: start, endTime: start, duration: 5400, transfers: 1, legs: [leg({ startTime: start })], ...over,
});

beforeEach(() => {
  jest.resetModules();
  AsyncStorage = require('@react-native-async-storage/async-storage');
  T = require('../src/transitous');
});

describe('transitous: localToUtcIso', () => {
  test('invierno en Madrid (UTC+1)', () => {
    expect(T.localToUtcIso('2026-12-01', '08:30', 'Europe/Madrid')).toBe('2026-12-01T07:30:00Z');
  });
  test('verano en Madrid (UTC+2)', () => {
    expect(T.localToUtcIso('2026-07-01', '08:30', 'Europe/Madrid')).toBe('2026-07-01T06:30:00Z');
  });
  test('otra zona: Nueva York en invierno (UTC-5)', () => {
    expect(T.localToUtcIso('2026-12-01', '08:30', 'America/New_York')).toBe('2026-12-01T13:30:00Z');
  });
  test('día del cambio de hora (29-03-2026 en Madrid): ya es UTC+2', () => {
    expect(T.localToUtcIso('2026-03-29', '08:30', 'Europe/Madrid')).toBe('2026-03-29T06:30:00Z');
  });
  test('pasa al día anterior en UTC cuando hace falta', () => {
    expect(T.localToUtcIso('2026-12-01', '00:00', 'Europe/Madrid')).toBe('2026-11-30T23:00:00Z');
  });
  test('sin zona usa la hora del dispositivo', () => {
    const esperado = new Date(2026, 11, 1, 8, 30).toISOString().replace('.000Z', 'Z');
    expect(T.localToUtcIso('2026-12-01', '08:30', '')).toBe(esperado);
  });
});

describe('transitous: formato de duración y modos', () => {
  test('fmtDur', () => {
    expect(T.fmtDur(45)).toBe('45 min');
    expect(T.fmtDur(60)).toBe('1 h');
    expect(T.fmtDur(125)).toBe('2 h 5 min');
    expect(T.fmtDur(0)).toBe('0 min');
    expect(T.fmtDur(-3)).toBe('0 min');
    expect(T.fmtDur(null)).toBe('0 min');
    expect(T.fmtDur(59.6)).toBe('1 h');
  });
  test.each([
    ['WALK', 'A pie'], ['BIKE', 'Bici'], ['RENTAL', 'Bici'], ['CAR', 'Coche'], ['AIRPLANE', 'Avión'],
    ['FERRY', 'Barco'], ['SUBWAY', 'Metro'], ['TRAM', 'Tranvía'], ['BUS', 'Autobús'], ['coach', 'Autobús'],
    ['HIGHSPEED_RAIL', 'Tren'], ['REGIONAL_RAIL', 'Tren'], ['SUBURBAN', 'Tren'], ['LONG_DISTANCE', 'Tren'],
    ['COSA_RARA', 'Transporte'], ['', 'Transporte'], [undefined, 'Transporte'],
  ])('modeLabel(%s) = %s', (mode, label) => expect(T.modeLabel(mode)).toBe(label));
  test('modeIcon', () => {
    expect(T.modeIcon('WALK')).toBe('🚶');
    expect(T.modeIcon('SUBWAY')).toBe('🚇');
    expect(T.modeIcon('COSA_RARA')).toBe('🚍');
  });
});

describe('transitous: summarize', () => {
  test('resume duración, transportes sin repetir y líneas (sin las de a pie)', () => {
    const option = {
      durationMin: 95,
      legs: [
        { mode: 'WALK', line: '' },
        { mode: 'SUBWAY', line: 'L1' },
        { mode: 'WALK', line: 'ignorada' },
        { mode: 'SUBWAY', line: 'L1' },
        { mode: 'REGIONAL_RAIL', line: 'R5' },
      ],
    };
    expect(T.summarize(option)).toEqual({ duration: '1 h 35 min', transports: ['A pie', 'Metro', 'Tren'], lines: 'L1, R5' });
  });
});

describe('transitous: TransitousError y errorMessage', () => {
  test('es un Error con tipo', () => {
    const e = new T.TransitousError('http', 'HTTP 500');
    expect(e).toBeInstanceOf(Error);
    expect(e.kind).toBe('http');
    expect(e.message).toBe('HTTP 500');
  });
  test.each([
    ['offline', 'No hay conexión a internet.'],
    ['timeout', 'Transitous tarda demasiado en responder.'],
    ['http', 'El servicio de Transitous no está disponible ahora mismo.'],
    ['empty', 'Transitous no ha encontrado rutas de transporte público para esa fecha y hora.'],
    ['limit', 'Has alcanzado el límite diario de consultas de rutas. Rellena los datos a mano o inténtalo mañana.'],
    ['format', 'Transitous ha devuelto una respuesta inesperada.'],
    ['otro', 'No se pudo consultar Transitous.'],
  ])('errorMessage(%s)', (kind, msg) => expect(T.errorMessage({ kind })).toBe(msg));
  test('errorMessage con undefined', () => {
    expect(T.errorMessage(undefined)).toBe('No se pudo consultar Transitous.');
  });
});

describe('transitous: geocode', () => {
  const place = (over = {}) => ({
    id: 'p1', name: 'Madrid', lat: 40.4168, lon: -3.7038, type: 'PLACE', tz: 'Europe/Madrid',
    areas: [{ name: 'Madrid', default: true, adminLevel: 8 }], country: 'ES', ...over,
  });

  test('devuelve lugares limpios con ciudad y país en español', async () => {
    fetch.mockResolvedValueOnce(okJson([place()]));
    const r = await T.geocode('Madrid');
    expect(r).toEqual([{ id: 'p1', name: 'Madrid', lat: 40.4168, lon: -3.7038, type: 'PLACE', tz: 'Europe/Madrid', place: 'Madrid, España' }]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.transitous.org/api/v1/geocode?text=Madrid&language=es');
  });
  test('descarta duplicados y lugares sin coordenadas o nombre, y limita a 8', async () => {
    const many = Array.from({ length: 12 }, (_, i) => place({ id: `x${i}`, name: `Lugar ${i}`, lat: 40 + i, lon: -3 }));
    fetch.mockResolvedValueOnce(okJson([place(), place(), place({ lat: null }), place({ name: '' }), null, ...many]));
    const r = await T.geocode('lugar');
    expect(r).toHaveLength(8);
    expect(r.filter((p) => p.name === 'Madrid')).toHaveLength(1);
  });
  test('textos de menos de 2 letras no consultan nada', async () => {
    expect(await T.geocode('a')).toEqual([]);
    expect(await T.geocode('  ')).toEqual([]);
    expect(await T.geocode(undefined)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  test('usa la caché: la segunda búsqueda igual no llama a la red', async () => {
    fetch.mockResolvedValueOnce(okJson([place()]));
    const a = await T.geocode('Madrid');
    const b = await T.geocode('  MADRID ');
    expect(b).toEqual(a);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test('lee la caché guardada en AsyncStorage (por ejemplo tras reiniciar la app)', async () => {
    const guardado = [{ id: 'p1', name: 'Madrid', lat: 40.4, lon: -3.7, type: 'PLACE', tz: 'Europe/Madrid', place: 'Madrid, España' }];
    await AsyncStorage.setItem('tr:geo2:madrid', JSON.stringify({ t: Date.now(), v: guardado }));
    expect(await T.geocode('Madrid')).toEqual(guardado);
    expect(fetch).not.toHaveBeenCalled();
  });
  test('una caché de más de 7 días se ignora', async () => {
    const vieja = Date.now() - 8 * 24 * 3600 * 1000;
    await AsyncStorage.setItem('tr:geo2:madrid', JSON.stringify({ t: vieja, v: [] }));
    fetch.mockResolvedValueOnce(okJson([{ id: 'p1', name: 'Madrid', lat: 40.4, lon: -3.7 }]));
    expect(await T.geocode('Madrid')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test('una respuesta que no es lista da error de formato', async () => {
    fetch.mockResolvedValueOnce(okJson({ error: 'x' }));
    await expect(T.geocode('Madrid')).rejects.toMatchObject({ kind: 'format' });
  });
  test('sin resultados devuelve lista vacía y no la cachea', async () => {
    fetch.mockResolvedValue(okJson([]));
    expect(await T.geocode('zzzzz')).toEqual([]);
    await T.geocode('zzzzz');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  test('errores de red, HTTP y tiempo agotado', async () => {
    fetch.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(T.geocode('uno')).rejects.toMatchObject({ kind: 'offline' });
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(T.geocode('dos')).rejects.toMatchObject({ kind: 'http' });
    const abort = new Error('abortado'); abort.name = 'AbortError';
    fetch.mockRejectedValueOnce(abort);
    await expect(T.geocode('tres')).rejects.toMatchObject({ kind: 'timeout' });
  });
  test('envía User-Agent propio en móvil', async () => {
    fetch.mockResolvedValueOnce(okJson([place()]));
    await T.geocode('Madrid');
    expect(fetch.mock.calls[0][1].headers['User-Agent']).toMatch(/^ProyectoViaje\/1\.0/);
  });
});

describe('transitous: planRoute', () => {
  const base = { from: MADRID, to: BCN, date: '2026-12-01' };

  test('con hora: pide 3 itinerarios y convierte la hora local a UTC', async () => {
    fetch.mockResolvedValueOnce(okJson({ itineraries: [itinerary('2026-12-01T08:00:00Z')] }));
    const r = await T.planRoute({ ...base, time: '08:30' });
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('/v5/plan?');
    expect(url).toContain('fromPlace=40.41680,-3.70380');
    expect(url).toContain('toPlace=41.38510,2.17340');
    expect(url).toContain('time=2026-12-01T07%3A30%3A00Z');
    expect(url).toContain('numItineraries=3');
    expect(url).not.toContain('searchWindow');
    expect(r.day).toBe(false);
    expect(r.tz).toBe('Europe/Madrid');
    expect(r.options).toHaveLength(1);
  });

  test('parsea itinerario y tramos', async () => {
    fetch.mockResolvedValueOnce(okJson({ itineraries: [itinerary('2026-12-01T08:00:00Z')] }));
    const { options } = await T.planRoute({ ...base, time: '08:30' });
    expect(options[0]).toMatchObject({ start: '2026-12-01T08:00:00Z', durationMin: 90, transfers: 1 });
    expect(options[0].legs[0]).toMatchObject({
      mode: 'HIGHSPEED_RAIL',
      from: 'Madrid',            // START se sustituye por el nombre del origen
      to: 'Barcelona Sants',
      durationMin: 150,
      distance: 620000,
      line: 'AVE',
      headsign: 'Barcelona',
      agency: 'Renfe',
      fromLat: 40.4, fromLon: -3.7, toLat: 41.37, toLon: 2.14,
      geo: [],
    });
  });

  test('decodifica y simplifica el trazado del tramo', async () => {
    // polyline de precisión 5 del ejemplo de Google: (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
    const geo = { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', precision: 5 };
    fetch.mockResolvedValueOnce(okJson({ itineraries: [itinerary('2026-12-01T08:00:00Z', { legs: [leg({ legGeometry: geo })] })] }));
    const { options } = await T.planRoute({ ...base, time: '08:30' });
    expect(options[0].legs[0].geo).toEqual([38.5, -120.2, 40.7, -120.95, 43.252, -126.453]);
  });

  test('sin hora: todas las salidas del día, solo las de ese día y ordenadas', async () => {
    fetch.mockResolvedValueOnce(okJson({ itineraries: [
      itinerary('2026-12-01T18:00:00Z'),
      itinerary('2026-11-30T22:00:00Z'), // antes de las 00:00 locales
      itinerary('2026-12-01T08:00:00Z'),
      itinerary('2026-12-02T00:30:00Z'), // ya es el día siguiente
    ] }));
    const r = await T.planRoute(base);
    expect(fetch.mock.calls[0][0]).toContain('searchWindow=86400');
    expect(fetch.mock.calls[0][0]).toContain('time=2026-11-30T23%3A00%3A00Z');
    expect(r.day).toBe(true);
    expect(r.options.map((o) => o.start)).toEqual(['2026-12-01T08:00:00Z', '2026-12-01T18:00:00Z']);
  });

  test('ignora itinerarios sin tramos', async () => {
    fetch.mockResolvedValueOnce(okJson({ itineraries: [itinerary('2026-12-01T08:00:00Z', { legs: [] }), itinerary('2026-12-01T09:00:00Z')] }));
    const { options } = await T.planRoute({ ...base, time: '08:30' });
    expect(options).toHaveLength(1);
  });

  test('sin rutas lanza error empty', async () => {
    fetch.mockResolvedValueOnce(okJson({ itineraries: [] }));
    await expect(T.planRoute({ ...base, time: '08:30' })).rejects.toMatchObject({ kind: 'empty' });
  });
  test('respuesta sin itinerarios lanza error format', async () => {
    fetch.mockResolvedValueOnce(okJson({ nada: 1 }));
    await expect(T.planRoute({ ...base, time: '08:30' })).rejects.toMatchObject({ kind: 'format' });
  });
  test('JSON inválido lanza error format', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
    await expect(T.planRoute({ ...base, time: '08:30' })).rejects.toMatchObject({ kind: 'format' });
  });
  test('HTTP 500 lanza error http; sin red lanza offline', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(T.planRoute({ ...base, time: '08:30' })).rejects.toMatchObject({ kind: 'http' });
    fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(T.planRoute({ ...base, time: '08:31' })).rejects.toMatchObject({ kind: 'offline' });
  });

  test('caché de rutas: la misma consulta no repite la petición; force la salta', async () => {
    fetch.mockResolvedValue(okJson({ itineraries: [itinerary('2026-12-01T08:00:00Z')] }));
    await T.planRoute({ ...base, time: '08:30' });
    await T.planRoute({ ...base, time: '08:30' });
    expect(fetch).toHaveBeenCalledTimes(1);
    await T.planRoute({ ...base, time: '08:30', force: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('tope diario: con 300 consultas hechas no llama a la red', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(`tr:count:${hoy}`, '300');
    await expect(T.planRoute({ ...base, time: '08:30' })).rejects.toMatchObject({ kind: 'limit' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('cada consulta suma al contador diario', async () => {
    fetch.mockResolvedValue(okJson({ itineraries: [itinerary('2026-12-01T08:00:00Z')] }));
    await T.planRoute({ ...base, time: '08:30' });
    const hoy = new Date().toISOString().slice(0, 10);
    expect(await AsyncStorage.getItem(`tr:count:${hoy}`)).toBe('1');
  });
});
