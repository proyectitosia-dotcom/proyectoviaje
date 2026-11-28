// Recorrido web con Playwright (no es un test de Jest). Uso: sirve la web (npm run web, o la carpeta de «npx expo export --platform web» en el puerto 8081) y ejecuta: node e2e/recorrido-rutas.js
// Crear viaje con fechas -> añadir trayecto en línea -> editar en ventana flotante (validar hora) -> cambiar de apartado -> trayecto en USD -> coste en Gastos.
// La red está interceptada: el BCE/Frankfurter responde con datos simulados y cualquier otra salida a internet se bloquea y se anota.
const { chromium } = require('playwright');
const path = require('path'); const os = require('os');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const bloqueadas = [];
  await p.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'api.frankfurter.app') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ rates: { USD: 1.25, GBP: 0.8, JPY: 160, CHF: 0.95, CAD: 1.5, AUD: 1.6, MXN: 20, CNY: 7.8 } }) });
    bloqueadas.push(u.hostname); return route.abort();
  });
  const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
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
  check('viaje creado (01-12-2026 → 10-12-2026)', (await texto()).includes('01-12-2026 → 10-12-2026'));

  // Añadir en línea
  await p.getByText('+ Añadir trayecto').click(); await p.waitForTimeout(400);
  check('«Añadir» abre el formulario en línea (sin diálogo)', (await texto()).includes('Nuevo trayecto') && (await p.locator('[aria-modal="true"]').count()) === 0);
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(300);
  check('sin origen ni destino no guarda', dialogs.some((d) => d.includes('El origen y el destino son obligatorios')));
  const lugares = p.getByPlaceholder('Ej. Madrid Atocha');
  await lugares.nth(0).fill('Madrid'); await lugares.nth(1).fill('Valencia');
  const campo = (label) => p.locator(`xpath=//*[normalize-space(text())="${label}"]/following::input[1]`);
  await campo('Precio · a mano').fill('30');
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(600);
  let t = await texto();
  check('trayecto guardado con la fecha de inicio del viaje', t.includes('1. Madrid → Valencia') && t.includes('01-12-2026'));

  // Editar en ventana flotante
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(os.tmpdir(), 'ruta-editar.png') });
  check('«Editar» abre la ventana flotante con los datos', (await texto()).includes('Editar trayecto') && (await p.locator('[aria-modal="true"]').count()) >= 1 && (await p.locator('input[value="Madrid"]').count()) === 1);
  await p.getByPlaceholder('Sin hora: todo el día').fill('8:30');
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(300);
  check('hora mal escrita: avisa y no cierra', dialogs.some((d) => d.includes('Hora no válida')) && (await texto()).includes('Editar trayecto'));
  await p.getByPlaceholder('Sin hora: todo el día').fill('08:30');
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(600);
  t = await texto();
  check('guardar cierra la ventana y actualiza la tarjeta (01-12-2026 · 08:30)', !t.includes('Editar trayecto') && t.includes('01-12-2026 · 08:30'));
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('Cancelar', { exact: true }).click(); await p.waitForTimeout(400);
  check('Cancelar cierra la ventana', !(await texto()).includes('Editar trayecto'));

  // Cambiar de apartado al editar
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('Otras rutas', { exact: true }).click(); await p.waitForTimeout(200);
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(600);
  t = await texto();
  check('el trayecto pasa a «Otras rutas» (contadores 0 y 1)', t.includes('Ruta general (0)') && t.includes('Otras rutas (1)'));
  await p.getByText('Otras rutas (1)').click(); await p.waitForTimeout(400);
  check('aparece en la pestaña «Otras rutas»', (await texto()).includes('1. Madrid → Valencia'));

  // Trayecto en otra divisa (cambio del BCE simulado: 1 USD = 0.8 €)
  await p.getByText('Ruta general (0)').click(); await p.waitForTimeout(300);
  await p.getByText('+ Añadir trayecto').click(); await p.waitForTimeout(400);
  const lug2 = p.getByPlaceholder('Ej. Madrid Atocha');
  await lug2.nth(0).fill('Valencia'); await lug2.nth(1).fill('Sevilla');
  await campo('Precio · a mano').fill('100');
  await p.getByText('USD', { exact: true }).first().click(); await p.waitForTimeout(400);
  check('en USD muestra «≈ 80.00 € (1 USD = 0.8 €)»', (await texto()).includes('≈ 80.00 € (1 USD = 0.8 €)'));
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(600);
  check('la tarjeta muestra «80.00 € (100 USD)»', (await texto()).includes('80.00 € (100 USD)'));
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(500);
  check('al editar vuelve el importe original (100) y la vista previa en USD', (await p.locator('input[value="100"]').count()) === 1 && (await texto()).includes('≈ 80.00 € (1 USD = 0.8 €)'));
  await p.getByText('Cancelar', { exact: true }).click(); await p.waitForTimeout(300);

  // El dólar baja a 0.5 en «Cambio de divisa»; al reeditar el trayecto sin tocar importe ni divisa se conserva el cambio original (0.8)
  await p.getByText('Gastos', { exact: true }).click(); await p.waitForTimeout(600);
  await p.getByText('Abrir ▼').click(); await p.waitForTimeout(300);
  const usd = await p.locator('input[value="0.8"]').elementHandle(); await usd.fill('0.5'); await usd.press('Enter'); await p.waitForTimeout(500);
  check('el cambio del dólar queda en 0.5', (await p.locator('input[value="0.5"]').count()) === 1);
  await p.getByText('Ruta', { exact: true }).click(); await p.waitForTimeout(500);
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('Guardar', { exact: true }).click(); await p.waitForTimeout(700);
  check('reeditar sin tocar importe ni divisa conserva «80.00 € (100 USD)»', (await texto()).includes('80.00 € (100 USD)'));

  // Gastos
  await p.getByText('Gastos', { exact: true }).click(); await p.waitForTimeout(800);
  t = await texto();
  check('Gastos: «Rutas del viaje» suma 110,00 € (30 € + 100 USD = 80 €)', t.includes('Rutas del viaje') && t.includes('110.00 €'));
  check('sin peticiones a otros servidores', bloqueadas.length === 0);
  console.log('ERRORES DE PÁGINA:', errs, '· bloqueadas:', bloqueadas);
  console.log(ok.every(Boolean) && !errs.length ? 'RESULTADO: todo OK' : 'RESULTADO: hay fallos');
  await b.close();
})().catch((e) => { console.error('EXCEPCIÓN', e.message.split('\n')[0]); process.exit(1); });
