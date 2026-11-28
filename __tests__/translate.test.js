// src/translate.js: traducción al español sin conexión («Original (traducción)»). Lógica pura, sin red.
import { translateEs, withEs } from '../src/translate';

describe('translate: withEs añade la traducción solo si es distinta', () => {
  test.each([
    ['Flughafen', 'Flughafen (Aeropuerto)'],
    ['München Hbf', 'München Hbf (Múnich estación central)'],
    ["Gare de l'Est", "Gare de l'Est (Estación del Este)"],
    ['Gare du Nord', 'Gare du Nord (Estación del Norte)'],
    ['Frankfurt am Main Hauptbahnhof', 'Frankfurt am Main Hauptbahnhof (Fráncfort del Meno estación central)'],
    ['Wien Westbahnhof', 'Wien Westbahnhof (Viena estación oeste)'],
    ['Köln Messe/Deutz', 'Köln Messe/Deutz (Colonia feria/Deutz)'],
    ['Zürich', 'Zürich (Zúrich)'],
    ['Berlin', 'Berlin (Berlín)'],
    ['Hlavní nádraží', 'Hlavní nádraží (Estación central)'],
    ['Firenze Santa Maria Novella', 'Firenze Santa Maria Novella (Florencia Santa Maria Novella)'],
    ['Donostia', 'Donostia (San Sebastián)'],
  ])('%s', (entrada, esperado) => expect(withEs(entrada)).toBe(esperado));
});

describe('translate: lo que no cambia se devuelve idéntico (sin paréntesis)', () => {
  test.each([
    'Estación de Atocha',
    'Madrid Atocha',
    'Sevilla Santa Justa',
    'Aeropuerto Adolfo Suárez Madrid-Barajas',
    'Atocha',
    'Rotterdam',
    'Berlín',          // ya con acento y en español
    'Москва',          // otro alfabeto: no se rompe
    '東京駅',
    'A pie',
  ])('%s', (t) => expect(withEs(t)).toBe(t));

  test('texto vacío, solo espacios, null y undefined', () => {
    expect(withEs('')).toBe('');
    expect(withEs('   ')).toBe('   ');
    expect(withEs(null)).toBe('');
    expect(withEs(undefined)).toBe('');
    expect(translateEs(null)).toBe('');
  });

  test('un número u otro tipo no falla', () => {
    expect(withEs(42)).toBe('42');
  });
});

describe('translate: mayúsculas, acentos y frases largas', () => {
  test('se reconocen en mayúsculas y minúsculas', () => {
    expect(withEs('HAUPTBAHNHOF')).toBe('HAUPTBAHNHOF (Estación central)');
    expect(withEs('hbf')).toBe('hbf (Estación central)');
    expect(withEs('hauptbahnhof')).toBe('hauptbahnhof (Estación central)');
  });
  test('se reconocen con y sin acento (ß→ss, ü→u)', () => {
    expect(translateEs('Zurich')).toBe('Zúrich');
    expect(translateEs('Zürich')).toBe('Zúrich');
    expect(translateEs('Straßburg')).toBe('Estrasburgo');
    expect(translateEs('Strassburg')).toBe('Estrasburgo');
  });
  test('la frase más larga gana a las palabras sueltas', () => {
    expect(translateEs('Frankfurt am Main')).toBe('Fráncfort del Meno');
    expect(translateEs('Frankfurt')).toBe('Fráncfort');
    expect(translateEs('Gare routière')).toBe('Estación de autobuses');
    expect(translateEs('Gare')).toBe('Estación');
  });
  test('la primera palabra se pone en mayúscula inicial si la traducción es minúscula', () => {
    expect(translateEs('Hauptbahnhof')).toBe('Estación central');
    expect(translateEs('Flughafen Berlin')).toBe('Aeropuerto Berlín');
  });
  test('en medio del texto las traducciones minúsculas se quedan en minúscula', () => {
    expect(translateEs('Berlin Hauptbahnhof')).toBe('Berlín estación central');
  });
});

describe('translate: separadores y estructura del texto', () => {
  test('conserva comas, guiones, barras, paréntesis y espacios', () => {
    expect(translateEs('München, Hbf (Gleis 3)')).toBe('Múnich, estación central (vía 3)');
    expect(translateEs('Köln-Deutz / Hbf')).toBe('Colonia-Deutz / estación central');
  });
  test('los números pegados a palabras no rompen nada', () => {
    expect(translateEs('Gleis 12')).toBe('Vía 12');
    expect(translateEs('Linie 5')).toBe('Linie 5');
  });
  test('el apóstrofo dentro de una palabra se respeta (l\'Est)', () => {
    expect(translateEs("Gare de l'Est")).toBe("Estación del Este");
  });
  test('un apóstrofo suelto o comillas en los bordes no se rompen', () => {
    expect(translateEs("'Hbf'")).toBe("'Estación central'");
    expect(translateEs("Hbf'")).toBe("Estación central'");
  });
  test('dos veces el mismo término', () => {
    expect(translateEs('Bahnhof Bahnhof')).toBe('Estación estación');
  });
  test('texto muy largo no se cuelga ni cambia lo desconocido', () => {
    const largo = 'Calle Mayor '.repeat(500);
    expect(translateEs(largo)).toBe(largo);
  });
});

describe('translate: limitaciones conocidas (decididas con el usuario)', () => {
  test('palabras del diccionario dentro de un nombre propio se traducen solas', () => {
    expect(withEs('Park Güell')).toBe('Park Güell (Parque Güell)');
  });
  test('no traduce frases libres ni palabras compuestas', () => {
    expect(withEs('Willkommen am Bahnhofsplatz')).toBe('Willkommen am Bahnhofsplatz');
    expect(withEs('Hauptbahnhofstraße')).toBe('Hauptbahnhofstraße');
  });
});
