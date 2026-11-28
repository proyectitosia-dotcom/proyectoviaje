// Recorrido web con Playwright (no es un test de Jest). Uso: sirve la web (npm run web, o la carpeta de «npx expo export --platform web» en el puerto 8081) y ejecuta: node e2e/recorrido-traduccion.js
// Ruta con Transitous SIMULADO (nombres en alemán): buscar lugares, consultar ruta, guardar y comprobar «Original (traducción)».
// La red está interceptada: api.transitous.org y api.frankfurter.app responden con datos simulados; cualquier otra salida a internet se bloquea y se anota.
const { chromium } = require('playwright');
const path = require('path'); const os = require('os');
const CORS = { 'access-control-allow-origin': '*' };
const LUGARES = {
  munchen: [{ id: 'muc', name: 'München Hbf', lat: 48.14, lon: 11.56, type: 'STOP', tz: 'Europe/Berlin', areas: [{ name: 'München', default: true, adminLevel: 8 }], country: 'DE' }],
  wien: [{ id: 'vie', name: 'Wien Westbahnhof', lat: 48.2, lon: 16.33, type: 'STOP', tz: 'Europe/Vienna', areas: [{ name: 'Wien', default: true, adminLevel: 8 }], country: 'AT' }],
};
const PLAN = { itineraries: [{ startTime: '2026-12-01T07:00:00Z', endTime: '2026-12-01T11:00:00Z', duration: 14400, transfers: 0, legs: [{ mode: 'HIGHSPEED_RAIL', from: { name: 'München Hbf', lat: 48.14, lon: 11.56 }, to: { name: 'Wien Westbahnhof', lat: 48.2, lon: 16.33 }, startTime: '2026-12-01T07:00:00Z', endTime: '2026-12-01T11:00:00Z', duration: 14400, routeShortName: 'RJX 63', headsign: 'Wien Hbf', agencyName: 'ÖBB' }] }] };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const bloqueadas = []; const transitous = [];
  await p.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'api.transitous.org') {
      transitous.push(u.pathname);
      if (u.pathname.endsWith('/geocode')) {
        const t = (u.searchParams.get('text') || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const k = Object.keys(LUGARES).find((x) => t.startsWith(x));
        return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(k ? LUGARES[k] : []) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(PLAN) });
    }
    if (u.hostname === 'api.frankfurter.app') return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ rates: { USD: 1.25, GBP: 0.8, JPY: 160, CHF: 0.95, CAD: 1.5, AUD: 1.6, MXN: 20, CNY: 7.8 } }) });
    bloqueadas.push(u.hostname); return route.abort();
  });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log(c ? 'OK   ' : 'FALLA', n); };
  const texto = async () => p.innerText('body');
  await p.goto('http://localhost:8081'); await p.waitForTimeout(2000);
  await p.locator('input').first().fill('Tester'); await p.getByText('Continuar').click(); await p.waitForTimeout(800);
  await p.getByPlaceholder('Verano en Italia').fill('Viaje prueba'); await p.getByText('Crear viaje').click(); await p.waitForTimeout(1200);
  await p.getByText('dd-mm-aaaa').first().click(); await p.waitForTimeout(300);
  await p.getByText('›', { exact: true }).click(); await p.waitForTimeout(300);
  await p.getByText('1', { exact: true }).first().click(); await p.waitForTimeout(400);
  await p.getByText('dd-mm-aaaa').first().click(); await p.waitForTimeout(300);
  await p.getByText('10', { exact: true }).first().click(); await p.waitForTimeout(400);
  await p.getByText('Continuar').click(); await p.waitForTimeout(1200);

  await p.getByText('+ Añadir trayecto').click(); await p.waitForTimeout(400);
  const lugares = p.getByPlaceholder('Ej. Madrid Atocha');
  await lugares.nth(0).fill('München'); await p.getByText('🔎 Buscar lugar').first().click(); await p.waitForTimeout(700);
  let t = await texto();
  check('la lista de resultados muestra «München Hbf (Múnich estación central)»', t.includes('München Hbf (Múnich estación central)'));
  check('…y la zona «München, Alemania» traducida', t.includes('München (Múnich), Alemania') || t.includes('München, Alemania (Múnich, Alemania)') || /München.*\(Múnich.*Alemania/.test(t));
  await p.getByText('München Hbf (Múnich estación central)').first().click(); await p.waitForTimeout(400);
  check('el ✔ del origen lleva la traducción', (await texto()).includes('✔ München Hbf (Múnich estación central)'));
  check('el campo de origen conserva el nombre ORIGINAL', (await p.locator('input[value="München Hbf"]').count()) === 1);
  await lugares.nth(1).fill('Wien'); await p.getByText('🔎 Buscar lugar').first().click(); await p.waitForTimeout(700);
  await p.getByText('Wien Westbahnhof (Viena estación oeste)').first().click(); await p.waitForTimeout(400);
  check('el ✔ del destino lleva la traducción', (await texto()).includes('✔ Wien Westbahnhof (Viena estación oeste)'));

  await p.getByText('🚆 Consultar ruta (Transitous)').click(); await p.waitForTimeout(1200);
  t = await texto();
  check('se consulta Transitous (simulado)', transitous.some((x) => x.endsWith('/plan')) && t.includes('Todas las salidas de ese día (1)'));
  check('en el detalle del trayecto el sentido sale «Wien Hbf (Viena estación central)»', t.includes('Wien Hbf (Viena estación central)'));
  check('las paradas del trayecto salen traducidas', t.includes('München Hbf (Múnich estación central)') && t.includes('Wien Westbahnhof (Viena estación oeste)'));
  check('la compañía «ÖBB» y la línea «RJX 63» no cambian', t.includes('RJX 63') && !t.includes('ÖBB ('));
  await p.screenshot({ path: path.join(os.tmpdir(), 'ruta-traduccion.png') });
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(700);
  t = await texto();
  check('la tarjeta guardada traduce Origen y Destino', t.includes('München Hbf (Múnich estación central)') && t.includes('Wien Westbahnhof (Viena estación oeste)'));
  await p.getByText('🗺️ Ver mapa').click(); await p.waitForTimeout(1200);
  check('el mapa del trazado se abre sin errores', (await texto()).includes('Ocultar mapa') && errs.length === 0);

  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(500);
  check('al editar los campos de origen y destino siguen con el nombre original', (await p.locator('input[value="München Hbf"]').count()) === 1 && (await p.locator('input[value="Wien Westbahnhof"]').count()) === 1);
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(600);
  check('guardar de nuevo no mete la traducción en los datos (sin «(Múnich» duplicado)', !/\(Múnich estación central\) \(/.test(await texto()));
  check('sin peticiones a otros servidores', bloqueadas.filter((h) => !/tile|openstreetmap/.test(h)).length === 0);
  console.log('ERRORES DE PÁGINA:', errs, '· bloqueadas:', [...new Set(bloqueadas)], '· Transitous:', transitous.length);
  console.log(ok.every(Boolean) && !errs.length ? 'RESULTADO: todo OK' : 'RESULTADO: hay fallos');
  await b.close();
})().catch((e) => { console.error('EXCEPCIÓN', e.message.split('\n')[0]); process.exit(1); });
