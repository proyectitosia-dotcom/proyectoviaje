// Recorrido web con Playwright (no es un test de Jest). Uso: sirve la web (npm run web, o la carpeta de «npx expo export --platform web» en el puerto 8081) y ejecuta: node e2e/recorrido-gastos.js
// Gastos con divisas: la red está interceptada (el BCE/Frankfurter responde con datos simulados; cualquier otra salida a internet se bloquea y se anota).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const bloqueadas = []; const peticionesFx = [];
  await p.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'api.frankfurter.app') {
      peticionesFx.push(u.href);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ rates: { USD: 1.25, GBP: 0.8, JPY: 160, CHF: 0.95, CAD: 1.5, AUD: 1.6, MXN: 20, CNY: 7.8 } }) });
    }
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

  await p.getByText('Gastos', { exact: true }).click(); await p.waitForTimeout(1500);
  check('al abrir Gastos se piden los cambios al BCE (una vez)', peticionesFx.length === 1 && peticionesFx[0].includes('from=EUR'));
  await p.getByText('Abrir ▼').click(); await p.waitForTimeout(300);
  check('la tarjeta «Cambio de divisa» muestra «Cambios actualizados (BCE)» y 1 USD = 0.8 €', (await texto()).includes('Cambios actualizados (BCE)') && (await p.locator('input[value="0.8"]').count()) === 1);
  await p.getByText('Cerrar ▲').click(); await p.waitForTimeout(200);

  const campo = (label) => p.locator(`xpath=//*[normalize-space(text())="${label}"]/following::input[1]`);
  await campo('Importe').fill('100');
  await p.getByText('USD', { exact: true }).first().click(); await p.waitForTimeout(400);
  check('en USD muestra «≈ 80.00 € (1 USD = 0.8 €)»', (await texto()).includes('≈ 80.00 € (1 USD = 0.8 €)'));
  check('elegir divisa con cambios recientes no repite la petición', peticionesFx.length === 1);
  await p.getByText('Añadir', { exact: true }).first().click(); await p.waitForTimeout(700);
  const t = await texto();
  check('el gasto se guarda en euros y se suma al total (80,00 €)', t.includes('80.00 €') && t.includes('100 USD'));
  check('sin peticiones a otros servidores', bloqueadas.length === 0);
  console.log('ERRORES DE PÁGINA:', errs, '· bloqueadas:', bloqueadas);
  console.log(ok.every(Boolean) && !errs.length ? 'RESULTADO: todo OK' : 'RESULTADO: hay fallos');
  await b.close();
})().catch((e) => { console.error('EXCEPCIÓN', e.message.split('\n')[0]); process.exit(1); });
