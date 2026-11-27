// Recorrido web con Playwright (no es un test de Jest). Uso: sirve la web (npm run web, o la carpeta de «npx expo export --platform web» en el puerto 8081) y ejecuta: node e2e/recorrido-hoteles.js
// Crear viaje con fechas obligatorias -> añadir hotel -> fechas dd-mm-aaaa, gasto por persona, ventana flotante de edición, precio en USD y Gastos.
// La red está interceptada: el BCE/Frankfurter responde con datos simulados (1 USD = 0.8 €) y cualquier otra salida a internet se bloquea y se anota.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const bloqueadas = [];
  await p.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'api.frankfurter.app') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ rates: { USD: 1.25, GBP: 0.8, JPY: 160, CHF: 0.95, CAD: 1.5, AUD: 1.6, MXN: 20, CNY: 7.8 } }) });
    bloqueadas.push(u.hostname); return route.abort();
  });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ok = []; const check = (n, c) => { ok.push([n, !!c]); console.log((c ? 'OK   ' : 'FALLA'), n); };
  await p.goto('http://localhost:8081'); await p.waitForTimeout(2000);
  await p.locator('input').first().fill('Tester'); await p.getByText('Continuar').click(); await p.waitForTimeout(800);
  await p.getByPlaceholder('Verano en Italia').fill('Viaje prueba'); await p.getByText('Crear viaje').click(); await p.waitForTimeout(1200);
  // Las fechas son obligatorias: sin elegirlas no se puede continuar
  await p.getByText('Continuar').click(); await p.waitForTimeout(500);
  check('sin fechas no pasa de la pantalla de fechas', (await p.innerText('body')).includes('¿Cuándo es el viaje?'));
  await p.getByText('dd-mm-aaaa').first().click(); await p.waitForTimeout(300);
  await p.getByText('›', { exact: true }).click(); await p.waitForTimeout(300);
  await p.getByText('1', { exact: true }).first().click(); await p.waitForTimeout(400);
  await p.getByText('dd-mm-aaaa').first().click(); await p.waitForTimeout(300);
  await p.getByText('4', { exact: true }).first().click(); await p.waitForTimeout(400);
  await p.getByText('Continuar').click(); await p.waitForTimeout(1200);
  check('viaje creado con rango 01-12-2026 → 04-12-2026', (await p.innerText('body')).includes('01-12-2026 → 04-12-2026'));

  await p.getByText('Hoteles', { exact: true }).click(); await p.waitForTimeout(600);
  await p.getByText('+ Añadir hotel').click(); await p.waitForTimeout(500);
  await p.getByPlaceholder('Roma').fill('Roma');
  // Fechas del hotel con el calendario (entrada 01, salida 04)
  const fechas = p.getByText('dd-mm-aaaa');
  await fechas.first().click(); await p.waitForTimeout(300);
  const infoCal = await p.innerText('body');
  console.log('calendario entrada abierto:', /(Noviembre|Diciembre) 2026/.test(infoCal));
  if (/Noviembre 2026/.test(infoCal)) { await p.getByText('›', { exact: true }).click(); await p.waitForTimeout(300); }
  await p.getByText('1', { exact: true }).first().click(); await p.waitForTimeout(400);
  await p.getByText('dd-mm-aaaa').first().click(); await p.waitForTimeout(300);
  await p.getByText('4', { exact: true }).first().click(); await p.waitForTimeout(400);
  // Nombre y precio (el campo de precio y el nombre se localizan por su etiqueta)
  const campo = (label) => p.locator(`xpath=//*[normalize-space(text())="${label}"]/following::input[1]`);
  await campo('Nombre del hotel *').fill('Hotel Sol');
  await campo('Precio/noche por habitación (EUR)').fill('100');
  await campo('Nº habitaciones').fill('2');
  await p.getByText('Guardar hotel').click(); await p.waitForTimeout(800);
  let body = await p.innerText('body');
  check('la tarjeta guarda el hotel', body.includes('Hotel Sol'));
  check('fila Fechas en dd-mm-aaaa', body.includes('01-12-2026 → 04-12-2026'));
  check('precio por persona (estancia) 150,00 €', body.includes('150.00 €'));

  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(600);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'modal-editar.png') });
  const modal = p.locator('[role="dialog"], [aria-modal="true"]');
  console.log('elementos de diálogo:', await modal.count());
  check('Editar abre el formulario', (await p.innerText('body')).includes('Editar hotel'));
  await p.getByText('Cancelar', { exact: true }).click(); await p.waitForTimeout(500);
  check('Cancelar cierra la ventana', !(await p.innerText('body')).includes('Editar hotel'));
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('Guardar hotel').click(); await p.waitForTimeout(600);
  check('Guardar cierra la ventana', !(await p.innerText('body')).includes('Editar hotel'));

  // Precio en USD (1 USD = 0.8 €): 100 USD/noche -> 80 € y gasto por persona = 80 × 3 ÷ 2 = 120 €
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('USD', { exact: true }).first().click(); await p.waitForTimeout(400);
  check('en USD muestra «≈ 80.00 € (1 USD = 0.8 €)»', (await p.innerText('body')).includes('≈ 80.00 € (1 USD = 0.8 €)'));
  await p.getByText('Guardar hotel').click(); await p.waitForTimeout(700);
  body = await p.innerText('body');
  check('la tarjeta muestra «80.00 € (100 USD)»', body.includes('80.00 € (100 USD)'));
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(400);
  check('al editar vuelve el importe original (100) en USD', (await p.locator('input[value="100"]').count()) >= 1 && (await p.innerText('body')).includes('Precio/noche por habitación (USD)'));
  await p.getByText('Cancelar', { exact: true }).click(); await p.waitForTimeout(300);

  // El dólar baja a 0.5 en «Cambio de divisa»; al reeditar el hotel sin tocar importe ni divisa se conserva el cambio original (0.8)
  await p.getByText('Gastos', { exact: true }).click(); await p.waitForTimeout(600);
  await p.getByText('Abrir ▼').click(); await p.waitForTimeout(300);
  const usd = await p.locator('input[value="0.8"]').elementHandle(); await usd.fill('0.5'); await usd.press('Enter'); await p.waitForTimeout(500);
  check('el cambio del dólar queda en 0.5', (await p.locator('input[value="0.5"]').count()) === 1);
  await p.getByText('Hoteles', { exact: true }).click(); await p.waitForTimeout(500);
  await p.getByText('Editar', { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('Guardar hotel').click(); await p.waitForTimeout(700);
  check('reeditar sin tocar importe ni divisa conserva «80.00 € (100 USD)»', (await p.innerText('body')).includes('80.00 € (100 USD)'));

  await p.getByText('Gastos', { exact: true }).click(); await p.waitForTimeout(800);
  body = await p.innerText('body');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'gastos.png') });
  check('Gastos: Hoteles del viaje = 120,00 € por persona (80 € × 3 noches ÷ 2)', body.includes('Hoteles del viaje') && body.includes('120.00 €') && !body.includes('600.00 €'));
  check('sin peticiones a otros servidores', bloqueadas.length === 0);
  console.log('ERRORES DE PÁGINA:', errs, '· bloqueadas:', bloqueadas);
  console.log(ok.every(([, v]) => v) && !errs.length ? 'RESULTADO: todo OK' : 'RESULTADO: hay fallos');
  await b.close();
})().catch(e => { console.error('EXCEPCIÓN', e.message.split('\n')[0]); process.exit(1); });
