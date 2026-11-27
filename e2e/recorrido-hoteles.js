// Recorrido web con Playwright (no es un test de Jest). Uso: sirve la web (npm run web, o la carpeta de «npx expo export --platform web» en el puerto 8081) y ejecuta: node e2e/recorrido-hoteles.js
// Crear viaje con fechas obligatorias -> añadir hotel -> fechas dd-mm-aaaa, gasto por persona, ventana flotante de edición y Gastos.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
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
  await campo('Precio/noche por habitación (€)').fill('100');
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

  await p.getByText('Gastos', { exact: true }).click(); await p.waitForTimeout(800);
  body = await p.innerText('body');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'gastos.png') });
  check('Gastos: Hoteles del viaje = 150,00 € (no 600)', body.includes('Hoteles del viaje') && body.includes('150.00 €') && !body.includes('600.00 €'));
  console.log('ERRORES DE PÁGINA:', errs);
  console.log(ok.every(([, v]) => v) && !errs.length ? 'RESULTADO: todo OK' : 'RESULTADO: hay fallos');
  await b.close();
})().catch(e => { console.error('EXCEPCIÓN', e.message.split('\n')[0]); process.exit(1); });
