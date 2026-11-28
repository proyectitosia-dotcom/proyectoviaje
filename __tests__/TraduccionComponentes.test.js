// Traducción al español en PlanView, PlaceSearch, RouteMap y la tarjeta de Rutas (diccionario sin conexión).
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import PlanView from '../src/components/PlanView';
import PlaceSearch from '../src/components/PlaceSearch';
import RouteMap from '../src/components/RouteMap';
import { geocode } from '../src/transitous';

jest.mock('../src/transitous', () => ({ ...jest.requireActual('../src/transitous'), geocode: jest.fn() }));

// Mapa de mentira: avisa de que está listo y guarda lo que le manda RouteMap
const mockEnviados = [];
jest.mock('../src/components/MapView', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MapViewFalso({ onMessage }, ref) {
      React.useImperativeHandle(ref, () => ({ post: (m) => mockEnviados.push(m) }));
      React.useEffect(() => { onMessage({ type: 'ready' }); }, []);
      return null;
    }),
  };
});

const tramo = (o = {}) => ({
  mode: 'HIGHSPEED_RAIL', from: 'München Hbf', to: 'Frankfurt am Main Hauptbahnhof', start: '2026-12-01T08:00:00Z', end: '2026-12-01T11:00:00Z',
  durationMin: 180, line: 'ICE 591', headsign: 'Flughafen', agency: 'Deutsche Bahn', fromLat: 48.14, fromLon: 11.56, toLat: 50.1, toLon: 8.66, geo: [], ...o,
});
const plan = (legs) => ({ start: '2026-12-01T08:00:00Z', end: '2026-12-01T11:00:00Z', durationMin: 180, transfers: 0, legs, tz: 'Europe/Madrid' });

describe('PlanView: paradas y sentidos «Original (Traducción)»', () => {
  test('traduce origen, destino y sentido de cada tramo', () => {
    render(<PlanView plan={plan([tramo()])} tz="Europe/Madrid" />);
    expect(screen.getByText(/München Hbf \(Múnich estación central\)/)).toBeTruthy();
    expect(screen.getByText(/Frankfurt am Main Hauptbahnhof \(Fráncfort del Meno estación central\)/)).toBeTruthy();
    expect(screen.getByText(/→ Flughafen \(Aeropuerto\)/)).toBeTruthy();
  });

  test('los nombres de línea y la compañía sin términos conocidos no cambian', () => {
    render(<PlanView plan={plan([tramo()])} tz="Europe/Madrid" />);
    expect(screen.getAllByText(/ICE 591/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Deutsche Bahn · /)).toBeTruthy();
    expect(screen.queryByText(/Deutsche Bahn \(/)).toBeNull();
  });

  test('los tramos «A pie» no cambian', () => {
    render(<PlanView plan={plan([tramo({ mode: 'WALK', line: '', headsign: '', agency: '', durationMin: 5, distance: 300, from: 'Bahnhof', to: 'Hotel' })])} tz="Europe/Madrid" />);
    expect(screen.getByText('A pie 5 min (300 m)')).toBeTruthy();
  });

  test('textos ya en español o sin términos conocidos salen idénticos', () => {
    render(<PlanView plan={plan([tramo({ from: 'Madrid Atocha', to: 'Sevilla Santa Justa', headsign: 'Sevilla', agency: 'Renfe' })])} tz="Europe/Madrid" />);
    expect(screen.getByText(/Madrid Atocha.*Sevilla Santa Justa/)).toBeTruthy();
    expect(screen.queryByText(/\(/)).toBeNull();
  });

  test('en modo compacto no muestra sentido ni compañía', () => {
    render(<PlanView plan={plan([tramo()])} tz="Europe/Madrid" compact />);
    expect(screen.queryByText(/Flughafen/)).toBeNull();
    expect(screen.queryByText(/Deutsche Bahn/)).toBeNull();
  });
});

describe('PlaceSearch: lugares traducidos en la lista y en el ✔', () => {
  const lugar = { id: 'p1', name: 'München Hbf', place: 'München, Deutschland', lat: 48.14, lon: 11.56, tz: 'Europe/Madrid' };
  test('la lista de resultados muestra nombre y zona traducidos', async () => {
    geocode.mockResolvedValue([lugar]);
    render(<PlaceSearch label="Origen *" text="München" onText={jest.fn()} place={null} onPick={jest.fn()} />);
    fireEvent.press(screen.getByText('🔎 Buscar lugar'));
    expect(await screen.findByText('München Hbf (Múnich estación central)')).toBeTruthy();
    expect(screen.getByText('München, Deutschland (Múnich, Alemania)')).toBeTruthy();
  });

  test('elegir un lugar rellena el texto con el nombre ORIGINAL (no la traducción)', async () => {
    geocode.mockResolvedValue([lugar]);
    const onText = jest.fn(); const onPick = jest.fn();
    render(<PlaceSearch label="Origen *" text="München" onText={onText} place={null} onPick={onPick} />);
    fireEvent.press(screen.getByText('🔎 Buscar lugar'));
    fireEvent.press(await screen.findByText('München Hbf (Múnich estación central)'));
    expect(onPick).toHaveBeenCalledWith(lugar);
    expect(onText).toHaveBeenCalledWith('München Hbf');
  });

  test('el ✔ del lugar elegido lleva la traducción', () => {
    render(<PlaceSearch label="Origen *" text="München Hbf" onText={jest.fn()} place={lugar} onPick={jest.fn()} />);
    expect(screen.getByText(/✔ München Hbf \(Múnich estación central\) · München, Deutschland \(Múnich, Alemania\)/)).toBeTruthy();
  });

  test('un lugar ya en español no lleva paréntesis', () => {
    render(<PlaceSearch label="Origen *" text="Madrid Atocha" onText={jest.fn()} place={{ id: 'a', name: 'Madrid Atocha', place: 'Madrid, España', lat: 40.4, lon: -3.69 }} onPick={jest.fn()} />);
    expect(screen.getByText('✔ Madrid Atocha · Madrid, España')).toBeTruthy();
  });
});

describe('RouteMap: etiquetas del mapa traducidas', () => {
  beforeEach(() => { mockEnviados.length = 0; });

  test('las paradas, la salida y la llegada llevan la traducción', async () => {
    const p = plan([tramo({ from: 'München Hbf', to: 'Nürnberg Hbf' }), tramo({ from: 'Nürnberg Hbf', to: 'Wien Westbahnhof', fromLat: 49.4, fromLon: 11.08, toLat: 48.2, toLon: 16.33 })]);
    render(<RouteMap plan={p} from={{ name: 'München Hbf', lat: 48.14, lon: 11.56 }} to={{ name: 'Wien Westbahnhof', lat: 48.2, lon: 16.33 }} />);
    await waitFor(() => expect(mockEnviados.length).toBeGreaterThan(0));
    const { points } = mockEnviados[mockEnviados.length - 1];
    expect(points.find((x) => x.kind === 'start').name).toBe('München Hbf (Múnich estación central)');
    expect(points.find((x) => x.kind === 'end').name).toBe('Wien Westbahnhof (Viena estación oeste)');
    expect(points.find((x) => x.kind === 'stop').name).toBe('Nürnberg Hbf (Núremberg estación central)');
  });

  test('el mensaje al mapa sigue siendo JSON válido con paréntesis, acentos y apóstrofos', async () => {
    const p = plan([tramo({ from: "Gare de l'Est", to: 'Gare du Nord' })]);
    render(<RouteMap plan={p} from={null} to={null} />);
    await waitFor(() => expect(mockEnviados.length).toBeGreaterThan(0));
    const m = mockEnviados[mockEnviados.length - 1];
    const ida = JSON.parse(JSON.stringify(m));
    expect(ida.points.map((x) => x.name)).toEqual(expect.arrayContaining(["Gare de l'Est (Estación del Este)", 'Gare du Nord (Estación del Norte)']));
    // así se inyecta en la WebView: no debe romper el JavaScript
    expect(() => new Function(`return (${JSON.stringify(m)});`)).not.toThrow();
  });

  test('un nombre ya en español no cambia', async () => {
    const p = plan([tramo({ from: 'Madrid Atocha', to: 'Sevilla Santa Justa' })]);
    render(<RouteMap plan={p} from={null} to={null} />);
    await waitFor(() => expect(mockEnviados.length).toBeGreaterThan(0));
    const names = mockEnviados[mockEnviados.length - 1].points.map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(['Madrid Atocha', 'Sevilla Santa Justa']));
  });
});
