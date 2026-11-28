// Pantalla Rutas: validaciones, hora opcional, secciones general/otras y edición en ventana flotante.
import React from 'react';
import { Alert, Modal, TextInput } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import RoutesScreen from '../src/screens/RoutesScreen';
import { TripRangeProvider } from '../src/tripRange';
import { planRoute } from '../src/transitous';

jest.mock('../src/transitous', () => ({ ...jest.requireActual('../src/transitous'), planRoute: jest.fn() }));

const MAD = { name: 'Madrid Atocha', lat: 40.4, lon: -3.69, tz: 'Europe/Madrid' };
const BCN = { name: 'Barcelona Sants', lat: 41.38, lon: 2.14, tz: 'Europe/Madrid' };
const ruta = (o = {}) => ({
  id: 'r1', name: '', origin: 'Madrid', destination: 'Barcelona', stops: [], date: '2026-12-02', time: '09:00',
  duration: '3h', cost: 50, transports: ['Tren'], lines: 'AVE', mode: 'transit', mapUrl: '', section: 'general', ...o,
});
const opcion = (start, durationMin) => ({
  start, end: start, durationMin, transfers: 0,
  legs: [{ mode: 'HIGHSPEED_RAIL', from: 'Madrid', to: 'Barcelona', start, end: start, durationMin, line: 'AVE', headsign: '', agency: '', geo: [] }],
});

let alerta;
beforeEach(() => { alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); planRoute.mockReset(); });
afterEach(() => jest.restoreAllMocks());

const montar = (trip, range = { start: '2026-12-01', end: '2026-12-10' }) => {
  const update = jest.fn();
  render(<TripRangeProvider start={range.start} end={range.end}><RoutesScreen trip={{ fxAt: Date.now(), ...trip }} update={update} /></TripRangeProvider>);
  return update;
};
const avisoCon = (titulo) => alerta.mock.calls.some((c) => c[0] === titulo);
const modalVisible = () => screen.UNSAFE_queryAllByType(Modal).some((m) => m.props.visible);
const escribirOrigenDestino = (o = 'Madrid', d = 'Valencia') => {
  const campos = screen.getAllByPlaceholderText('Ej. Madrid Atocha');
  fireEvent.changeText(campos[0], o);
  fireEvent.changeText(campos[1], d);
};

describe('RoutesScreen: añadir trayecto (formulario en línea)', () => {
  test('se abre en línea, con la fecha de inicio del viaje, y no en ventana flotante', () => {
    montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    expect(screen.getByText('Nuevo trayecto')).toBeTruthy();
    expect(modalVisible()).toBe(false);
    expect(screen.getByText('01-12-2026')).toBeTruthy();
  });

  test('origen y destino son obligatorios', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    fireEvent.press(screen.getByText('Guardar'));
    expect(avisoCon('Faltan datos')).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  test('guarda el trayecto con origen, destino, fecha del viaje y sin hora', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.press(screen.getByText('Guardar'));
    expect(update).toHaveBeenCalledTimes(1);
    const [r] = update.mock.calls[0][0].routes;
    expect(r).toMatchObject({ origin: 'Madrid', destination: 'Valencia', date: '2026-12-01', time: '', section: 'general', cost: 0, stops: [] });
    expect(r.id).toBeTruthy();
    expect(screen.queryByText('Nuevo trayecto')).toBeNull();
  });

  test('la hora es opcional pero, si se escribe, debe ser HH:MM de 24 h', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    const hora = screen.getByPlaceholderText('Sin hora: todo el día');
    fireEvent.changeText(hora, '25:99');
    fireEvent.press(screen.getByText('Guardar'));
    expect(avisoCon('Hora no válida')).toBe(true);
    expect(update).not.toHaveBeenCalled();
    fireEvent.changeText(hora, '8:30');
    fireEvent.press(screen.getByText('Guardar'));
    expect(update).not.toHaveBeenCalled();
    fireEvent.changeText(hora, '08:30');
    fireEvent.press(screen.getByText('Guardar'));
    expect(update.mock.calls[0][0].routes[0].time).toBe('08:30');
  });

  test('el coste no puede ser negativo y admite coma decimal', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    // el único campo con teclado decimal es el precio
    const precio = screen.UNSAFE_getAllByProps({ keyboardType: 'decimal-pad' })[0];
    fireEvent.changeText(precio, '-5');
    fireEvent.press(screen.getByText('Guardar'));
    expect(avisoCon('Coste no válido')).toBe(true);
    fireEvent.changeText(precio, '12,5');
    fireEvent.press(screen.getByText('Guardar'));
    expect(update.mock.calls[0][0].routes[0].cost).toBe(12.5);
  });

  test('el enlace de Google Maps debe ser de Google Maps', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    const enlace = screen.getByPlaceholderText('https://maps.app.goo.gl/...');
    fireEvent.changeText(enlace, 'https://example.com');
    fireEvent.press(screen.getByText('Guardar'));
    expect(avisoCon('Enlace no válido')).toBe(true);
    expect(update).not.toHaveBeenCalled();
    fireEvent.changeText(enlace, 'https://maps.app.goo.gl/abc');
    fireEvent.press(screen.getByText('Guardar'));
    expect(update.mock.calls[0][0].routes[0].mapUrl).toBe('https://maps.app.goo.gl/abc');
  });

  test('las paradas intermedias se separan por comas', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.changeText(screen.getByPlaceholderText('Zaragoza, Barcelona'), ' Zaragoza , , Lleida ');
    fireEvent.press(screen.getByText('Guardar'));
    expect(update.mock.calls[0][0].routes[0].stops).toEqual(['Zaragoza', 'Lleida']);
  });

  test('Cancelar cierra el formulario sin guardar', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Nuevo trayecto')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('RoutesScreen: fechas del viaje', () => {
  test('una fecha fuera del rango del viaje no se guarda', () => {
    const update = montar({ routes: [ruta({ date: '2027-01-01' })] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Guardar'));
    expect(avisoCon('Fecha fuera del viaje')).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  test('una fecha imposible (31-02) no se guarda', () => {
    const update = montar({ routes: [ruta({ date: '2026-02-31' })] }, { start: '', end: '' });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Guardar'));
    expect(avisoCon('Fecha no válida')).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  test('la tarjeta muestra la fecha en dd-mm-aaaa y la hora', () => {
    montar({ routes: [ruta()] });
    expect(screen.getByText('02-12-2026 · 09:00')).toBeTruthy();
    expect(screen.getAllByText('50.00 €').length).toBeGreaterThanOrEqual(1);   // precio del trayecto y coste total
  });

  test('sin fecha la tarjeta dice «Sin fecha»', () => {
    montar({ routes: [ruta({ date: '', time: '' })] }, { start: '', end: '' });
    expect(screen.getByText('Sin fecha')).toBeTruthy();
  });
});

describe('RoutesScreen: secciones Ruta general / Otras rutas', () => {
  const trip = { routes: [ruta({ id: 'a', name: 'Ida', date: '2026-12-02' }), ruta({ id: 'b', name: 'Vuelta', origin: 'Barcelona', destination: 'Madrid', date: '2026-12-05' }), ruta({ id: 'c', name: 'Excursión', section: 'otras', date: '2026-12-03' })] };

  test('los contadores y el contenido dependen del apartado abierto', () => {
    montar(trip);
    expect(screen.getByText('Ruta general (2)')).toBeTruthy();
    expect(screen.getByText('Otras rutas (1)')).toBeTruthy();
    expect(screen.getByText('1. Ida')).toBeTruthy();
    expect(screen.queryByText('1. Excursión')).toBeNull();
    fireEvent.press(screen.getByText('Otras rutas (1)'));
    expect(screen.getByText('1. Excursión')).toBeTruthy();
    expect(screen.queryByText('1. Ida')).toBeNull();
  });

  test('el enlace de la ruta completa solo aparece en la ruta general con más de un trayecto', () => {
    montar(trip);
    expect(screen.getByText('Ver ruta completa en Google Maps')).toBeTruthy();
    fireEvent.press(screen.getByText('Otras rutas (1)'));
    expect(screen.queryByText('Ver ruta completa en Google Maps')).toBeNull();
    expect(screen.getByText(/no se añaden a la ruta completa/)).toBeTruthy();
  });

  test('el coste total es el de la sección abierta', () => {
    montar({ routes: [ruta({ id: 'a', cost: 50 }), ruta({ id: 'c', section: 'otras', cost: 7 })] });
    expect(screen.getAllByText('50.00 €').length).toBeGreaterThanOrEqual(1);
    fireEvent.press(screen.getByText('Otras rutas (1)'));
    expect(screen.getAllByText('7.00 €').length).toBeGreaterThanOrEqual(1);
  });

  test('un trayecto nuevo creado desde «Otras rutas» se guarda en ese apartado', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('Otras rutas (0)'));
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.press(screen.getByText('Guardar'));
    expect(update.mock.calls[0][0].routes[0].section).toBe('otras');
  });

  test('al editar se puede cambiar el apartado del trayecto', () => {
    const update = montar({ routes: [ruta()] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Otras rutas'));   // chip «Apartado» del formulario
    fireEvent.press(screen.getByText('Guardar'));
    expect(update.mock.calls[0][0].routes[0]).toMatchObject({ id: 'r1', section: 'otras' });
  });

  test('un trayecto sin apartado (datos antiguos) cuenta como ruta general', () => {
    montar({ routes: [ruta({ section: undefined })] });
    expect(screen.getByText('Ruta general (1)')).toBeTruthy();
  });
});

describe('RoutesScreen: editar en ventana flotante', () => {
  test('«Editar» abre el Modal con los datos cargados y se cierra al guardar', () => {
    const update = montar({ routes: [ruta({ stops: ['Zaragoza'] })] });
    expect(modalVisible()).toBe(false);
    fireEvent.press(screen.getByText('Editar'));
    expect(screen.getByText('Editar trayecto')).toBeTruthy();
    expect(modalVisible()).toBe(true);
    expect(screen.getByDisplayValue('Madrid')).toBeTruthy();
    expect(screen.getByDisplayValue('09:00')).toBeTruthy();
    expect(screen.getByDisplayValue('Zaragoza')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar'));
    expect(modalVisible()).toBe(false);
    expect(update.mock.calls[0][0].routes[0]).toMatchObject({ id: 'r1', origin: 'Madrid', destination: 'Barcelona', stops: ['Zaragoza'], time: '09:00' });
  });

  test('«Cancelar» y el botón atrás cierran la ventana sin guardar', () => {
    const update = montar({ routes: [ruta()] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(modalVisible()).toBe(false);
    fireEvent.press(screen.getByText('Editar'));
    const modal = screen.UNSAFE_getAllByType(Modal).find((m) => m.props.visible);
    modal.props.onRequestClose();
    expect(screen.queryByText('Editar trayecto')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  test('editar no duplica el trayecto y mantiene el orden por fecha', () => {
    const update = montar({ routes: [ruta({ id: 'a', date: '2026-12-02' }), ruta({ id: 'b', date: '2026-12-05' })] });
    fireEvent.press(screen.getAllByText('Editar')[0]);
    fireEvent.press(screen.getByText('Guardar'));
    expect(update.mock.calls[0][0].routes.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('RoutesScreen: eliminar', () => {
  test('pide confirmación y quita el trayecto', () => {
    alerta.mockImplementation((t, m, botones) => botones && botones.find((b) => b.text === 'Sí').onPress());
    const update = montar({ routes: [ruta({ id: 'a' }), ruta({ id: 'b', date: '2026-12-05' })] });
    fireEvent.press(screen.getAllByText('Eliminar')[0]);
    expect(update.mock.calls[0][0].routes.map((r) => r.id)).toEqual(['b']);
  });
});

describe('RoutesScreen: Consultar ruta (Transitous mockeado)', () => {
  const conLugares = ruta({ from: MAD, to: BCN, time: '' });

  test('sin lugares elegidos pide buscarlos y no consulta', () => {
    montar({ routes: [ruta()] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('🚆 Consultar ruta (Transitous)'));
    expect(avisoCon('Faltan lugares')).toBe(true);
    expect(planRoute).not.toHaveBeenCalled();
  });

  test('sin hora consulta todo el día y lista las salidas', async () => {
    planRoute.mockResolvedValue({ options: [opcion('2026-12-02T08:00:00Z', 150), opcion('2026-12-02T12:00:00Z', 170)], tz: 'Europe/Madrid', day: true });
    montar({ routes: [conLugares] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('🚆 Consultar ruta (Transitous)'));
    await waitFor(() => expect(screen.getByText('Todas las salidas de ese día (2). Elige una:')).toBeTruthy());
    expect(planRoute).toHaveBeenCalledWith({ from: MAD, to: BCN, date: '2026-12-02', time: '' });
  });

  test('con hora la envía y muestra «Elige una opción»', async () => {
    planRoute.mockResolvedValue({ options: [opcion('2026-12-02T08:00:00Z', 150)], tz: 'Europe/Madrid', day: false });
    montar({ routes: [{ ...conLugares, time: '08:30' }] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('🚆 Consultar ruta (Transitous)'));
    await waitFor(() => expect(screen.getByText('Elige una opción:')).toBeTruthy());
    expect(planRoute).toHaveBeenCalledWith({ from: MAD, to: BCN, date: '2026-12-02', time: '08:30' });
  });

  test('una hora inválida no consulta', () => {
    montar({ routes: [{ ...conLugares, time: '9h' }] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('🚆 Consultar ruta (Transitous)'));
    expect(avisoCon('Hora no válida')).toBe(true);
    expect(planRoute).not.toHaveBeenCalled();
  });

  test('elegir una opción rellena duración, transportes y líneas, y se guarda con el trayecto', async () => {
    planRoute.mockResolvedValue({ options: [opcion('2026-12-02T08:00:00Z', 150)], tz: 'Europe/Madrid', day: true });
    const update = montar({ routes: [conLugares] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('🚆 Consultar ruta (Transitous)'));
    await waitFor(() => expect(screen.getByText('Todas las salidas de ese día (1). Elige una:')).toBeTruthy());
    expect(screen.getByDisplayValue('2 h 30 min')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar'));
    const r = update.mock.calls[0][0].routes[0];
    expect(r.duration).toBe('2 h 30 min');
    expect(r.lines).toBe('AVE');
    expect(r.plan).toMatchObject({ start: '2026-12-02T08:00:00Z', tz: 'Europe/Madrid' });
  });

  test('si Transitous falla se muestra un mensaje claro y se puede seguir a mano', async () => {
    const { TransitousError } = jest.requireActual('../src/transitous');
    planRoute.mockRejectedValue(new TransitousError('offline', 'x'));
    montar({ routes: [conLugares] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('🚆 Consultar ruta (Transitous)'));
    await waitFor(() => expect(screen.getByText('No hay conexión a internet. Puedes rellenar la duración y el precio a mano.')).toBeTruthy());
  });

  test('«Actualizar» sin lugares de Transitous explica qué hacer', () => {
    montar({ routes: [ruta()] });
    fireEvent.press(screen.getByText('🔄 Actualizar'));
    expect(avisoCon('No se puede actualizar')).toBe(true);
    expect(planRoute).not.toHaveBeenCalled();
  });
});

describe('RoutesScreen: divisa del precio', () => {
  const precio = () => screen.UNSAFE_getAllByType(TextInput).filter((t) => t.props.keyboardType === 'decimal-pad')[0];
  const guardada = (update) => update.mock.calls[0][0].routes[0];

  test('en euros se guarda el precio tal cual y sin «orig» ni «currency»', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.changeText(precio(), '20');
    fireEvent.press(screen.getByText('Guardar'));
    const r = guardada(update);
    expect(r.cost).toBe(20);
    expect('orig' in r).toBe(false);
    expect('currency' in r).toBe(false);
  });

  test('en USD muestra la vista previa y guarda euros + el importe original', () => {
    const update = montar({ fx: { USD: 0.9 }, routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.changeText(precio(), '100');
    fireEvent.press(screen.getByText('USD'));
    expect(screen.getByText('≈ 90.00 € (1 USD = 0.9 €)')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar'));
    const r = guardada(update);
    expect(r.cost).toBe(90);
    expect(r.orig).toEqual({ amount: 100, currency: 'USD', rate: 0.9 });
    expect('currency' in r).toBe(false);
  });

  test('admite coma decimal en la divisa elegida', () => {
    const update = montar({ fx: { GBP: 1.2 }, routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.changeText(precio(), '12,5');
    fireEvent.press(screen.getByText('GBP'));
    fireEvent.press(screen.getByText('Guardar'));
    expect(guardada(update)).toMatchObject({ cost: 15, orig: { amount: 12.5, currency: 'GBP', rate: 1.2 } });
  });

  test('un precio vacío se guarda como 0 y uno negativo sigue siendo «Coste no válido»', () => {
    const update = montar({ routes: [] });
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.press(screen.getByText('Guardar'));
    expect(guardada(update).cost).toBe(0);
    update.mockClear();
    fireEvent.press(screen.getByText('+ Añadir trayecto'));
    escribirOrigenDestino();
    fireEvent.changeText(precio(), '-5');
    fireEvent.press(screen.getByText('Guardar'));
    expect(avisoCon('Coste no válido')).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  test('la tarjeta muestra «90.00 € (100 USD)» y en euros sin paréntesis', () => {
    montar({ routes: [ruta({ id: 'a', cost: 90, orig: { amount: 100, currency: 'USD', rate: 0.9 } }), ruta({ id: 'b', cost: 20, date: '2026-12-05' })] });
    expect(screen.getByText('90.00 € (100 USD)')).toBeTruthy();
    expect(screen.getAllByText('20.00 €').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/20\.00 € \(/)).toBeNull();
  });

  test('al editar recupera el importe y la divisa originales', () => {
    montar({ fx: { USD: 0.9 }, routes: [ruta({ cost: 90, orig: { amount: 100, currency: 'USD', rate: 0.9 } })] });
    fireEvent.press(screen.getByText('Editar'));
    expect(screen.getByDisplayValue('100')).toBeTruthy();
    expect(screen.getByText('≈ 90.00 € (1 USD = 0.9 €)')).toBeTruthy();
  });

  test('al pasar a euros al editar desaparece «orig» y el coste es el importe escrito', () => {
    const update = montar({ fx: { USD: 0.9 }, routes: [ruta({ cost: 90, orig: { amount: 100, currency: 'USD', rate: 0.9 } })] });
    fireEvent.press(screen.getByText('Editar'));
    fireEvent.press(screen.getByText('EUR'));
    fireEvent.press(screen.getByText('Guardar'));
    const r = guardada(update);
    expect(r.cost).toBe(100);
    expect('orig' in r).toBe(false);
  });

  test('un trayecto antiguo (sin orig ni divisa) se edita y guarda en euros sin romperse', () => {
    const update = montar({ routes: [ruta({ cost: 50 })] });
    fireEvent.press(screen.getByText('Editar'));
    expect(screen.getByDisplayValue('50')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar'));
    const r = guardada(update);
    expect(r.cost).toBe(50);
    expect('orig' in r).toBe(false);
  });

  // Al editar se conserva el cambio original; solo se recalcula si se cambia el importe o la divisa
  describe('al editar se conserva el cambio original', () => {
    // Trayecto guardado en USD con cambio 0.9 (100 USD = 90 €); hoy el dólar vale 1.0
    const enUsd = ruta({ cost: 90, orig: { amount: 100, currency: 'USD', rate: 0.9 } });
    const hoy = { fx: { USD: 1, GBP: 1.2 } };
    const editar = () => fireEvent.press(screen.getByText('Editar'));
    const guardar = () => fireEvent.press(screen.getByText('Guardar'));

    test('sin tocar importe ni divisa: coste 90 y rate 0.9 (no se reconvierte)', () => {
      const update = montar({ ...hoy, routes: [enUsd] });
      editar(); guardar();
      const r = guardada(update);
      expect(r.cost).toBe(90);
      expect(r.orig).toEqual({ amount: 100, currency: 'USD', rate: 0.9 });
    });

    test('cambiar otro campo (hora, paradas) sigue conservando el cambio', () => {
      const update = montar({ ...hoy, routes: [enUsd] });
      editar();
      fireEvent.changeText(screen.getByPlaceholderText('Sin hora: todo el día'), '10:15');
      fireEvent.changeText(screen.getByPlaceholderText('Zaragoza, Barcelona'), 'Lleida');
      guardar();
      const r = guardada(update);
      expect(r).toMatchObject({ time: '10:15', stops: ['Lleida'], cost: 90 });
      expect(r.orig.rate).toBe(0.9);
    });

    test('cambiar el importe recalcula con el cambio de hoy (120 USD × 1.0 = 120 €)', () => {
      const update = montar({ ...hoy, routes: [enUsd] });
      editar();
      fireEvent.changeText(precio(), '120');
      guardar();
      const r = guardada(update);
      expect(r.cost).toBe(120);
      expect(r.orig).toEqual({ amount: 120, currency: 'USD', rate: 1 });
    });

    test('cambiar la divisa recalcula: a EUR desaparece orig; a GBP usa el cambio de hoy', () => {
      let update = montar({ ...hoy, routes: [enUsd] });
      editar();
      fireEvent.press(screen.getByText('EUR'));
      guardar();
      expect(guardada(update).cost).toBe(100);
      expect('orig' in guardada(update)).toBe(false);
    });

    test('a GBP con el mismo importe recalcula con el cambio de hoy', () => {
      const update = montar({ ...hoy, routes: [enUsd] });
      editar();
      fireEvent.press(screen.getByText('GBP'));
      guardar();
      expect(guardada(update)).toMatchObject({ cost: 120, orig: { amount: 100, currency: 'GBP', rate: 1.2 } });
    });

    test('cambiar el importe y volver al original conserva el cambio original', () => {
      const update = montar({ ...hoy, routes: [enUsd] });
      editar();
      fireEvent.changeText(precio(), '120');
      fireEvent.changeText(precio(), '100');
      guardar();
      expect(guardada(update)).toMatchObject({ cost: 90, orig: { rate: 0.9 } });
    });

    test('un trayecto en euros se conserva idéntico y sin orig', () => {
      const update = montar({ ...hoy, routes: [ruta({ cost: 20 })] });
      editar();
      fireEvent.changeText(screen.getByPlaceholderText('Sin hora: todo el día'), '11:00');
      guardar();
      const r = guardada(update);
      expect(r.cost).toBe(20);
      expect('orig' in r).toBe(false);
    });

    test('un trayecto antiguo con orig sin rate: se deduce 90/100 = 0.9', () => {
      const update = montar({ ...hoy, routes: [ruta({ cost: 90, orig: { amount: 100, currency: 'USD' } })] });
      editar(); guardar();
      const r = guardada(update);
      expect(r.cost).toBe(90);
      expect(r.orig).toEqual({ amount: 100, currency: 'USD', rate: 0.9 });
    });

    test('con coma decimal: reescribir el mismo importe se considera sin tocar', () => {
      const update = montar({ ...hoy, routes: [ruta({ cost: 11.25, orig: { amount: 12.5, currency: 'USD', rate: 0.9 } })] });
      editar();
      fireEvent.changeText(precio(), '12,5');
      guardar();
      const r = guardada(update);
      expect(r.cost).toBe(11.25);
      expect(r.orig.rate).toBe(0.9);
    });

    test('un trayecto nuevo siempre se convierte con el cambio de hoy', () => {
      const update = montar({ ...hoy, routes: [] });
      fireEvent.press(screen.getByText('+ Añadir trayecto'));
      escribirOrigenDestino();
      fireEvent.changeText(precio(), '100');
      fireEvent.press(screen.getByText('GBP'));
      fireEvent.press(screen.getByText('Guardar'));
      expect(guardada(update)).toMatchObject({ cost: 120, orig: { amount: 100, currency: 'GBP', rate: 1.2 } });
    });
  });

  test('con cambios caducados se descargan al abrir Ruta (BCE simulado) y se guardan en el viaje', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rates: { USD: 1.25, GBP: 0.8, JPY: 160, CHF: 0.95, CAD: 1.5, AUD: 1.6, MXN: 20, CNY: 7.8 } }) });
    const update = jest.fn();
    render(<TripRangeProvider start="2026-12-01" end="2026-12-10"><RoutesScreen trip={{ routes: [], fx: {}, fxAt: Date.now() - 2 * 3600 * 1000 }} update={update} /></TripRangeProvider>);
    await waitFor(() => expect(update).toHaveBeenCalledWith({ fx: expect.objectContaining({ USD: 0.8 }), fxAt: expect.any(Number) }));
    expect(fetch.mock.calls[0][0]).toContain('api.frankfurter.app');
  });

  test('con cambios recientes no se hace ninguna petición al abrir Ruta', () => {
    montar({ routes: [] });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('RoutesScreen: traducción al español en la tarjeta', () => {
  const MUC = { name: 'München Hbf', lat: 48.14, lon: 11.56, tz: 'Europe/Berlin' };
  const VIE = { name: 'Wien Westbahnhof', lat: 48.2, lon: 16.33, tz: 'Europe/Vienna' };
  const base = { origin: 'München Hbf', destination: 'Wien Westbahnhof', name: 'Ida' };

  test('con lugares de Transitous las filas Origen y Destino llevan la traducción', () => {
    montar({ routes: [ruta({ ...base, from: MUC, to: VIE })] });
    expect(screen.getByText('München Hbf (Múnich estación central)')).toBeTruthy();
    expect(screen.getByText('Wien Westbahnhof (Viena estación oeste)')).toBeTruthy();
  });

  test('si el origen o el destino se escribieron a mano NO se traducen', () => {
    montar({ routes: [ruta({ ...base })] });
    expect(screen.getByText('München Hbf')).toBeTruthy();
    expect(screen.getByText('Wien Westbahnhof')).toBeTruthy();
    expect(screen.queryByText(/\(Múnich/)).toBeNull();
  });

  test('con solo el origen de Transitous se traduce el origen y no el destino', () => {
    montar({ routes: [ruta({ ...base, from: MUC })] });
    expect(screen.getByText('München Hbf (Múnich estación central)')).toBeTruthy();
    expect(screen.getByText('Wien Westbahnhof')).toBeTruthy();
  });

  test('lo que escribe el usuario (nombre, paradas) no se traduce', () => {
    montar({ routes: [ruta({ ...base, from: MUC, to: VIE, name: 'Hauptbahnhof tour', stops: ['Hbf Salzburg'] })] });
    expect(screen.getByText('1. Hauptbahnhof tour')).toBeTruthy();
    expect(screen.getByText('Hbf Salzburg')).toBeTruthy();
  });

  test('un lugar ya en español no lleva paréntesis', () => {
    montar({ routes: [ruta({ origin: 'Madrid Atocha', destination: 'Sevilla Santa Justa', name: 'AVE', from: MAD, to: BCN })] });
    expect(screen.getByText('Madrid Atocha')).toBeTruthy();
    expect(screen.getByText('Sevilla Santa Justa')).toBeTruthy();
  });

  test('al editar y guardar, el origen y el destino guardados siguen siendo los ORIGINALES (la traducción no se cuela)', () => {
    const update = montar({ routes: [ruta({ ...base, from: MUC, to: VIE })] });
    fireEvent.press(screen.getByText('Editar'));
    expect(screen.getByDisplayValue('München Hbf')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar'));
    const r = update.mock.calls[0][0].routes[0];
    expect(r.origin).toBe('München Hbf');
    expect(r.destination).toBe('Wien Westbahnhof');
  });
});
