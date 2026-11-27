# Mainsave_Tests — contexto importante del subchat «Tests»

> **Cómo se usa este archivo (orden del usuario):**
> - Este subchat **lo lee siempre que necesite saber el contexto** de su apartado (al empezar una sesión nueva, tras un `/clear`, un reinicio o una compactación).
> - Se **actualiza con cada cambio que hagas**, añadiendo **solo la información importante nueva** (no se reescribe entero, no se duplica, no se guardan datos personales ni claves). Va en el mismo commit que el cambio.
> - Vive en el repositorio, junto al resto de la app. El resumen de TODA la app y de las órdenes generales está en `Mainsave.md` (chat principal): consúltalo si necesitas más contexto.

---

## 1. La app en dos líneas
**Proyecto Viaje**: app para gestionar un viaje (ruta, mapa, hoteles, calendario, gastos y grupo), compartible en tiempo real. **Expo SDK 52 + React Native 0.76** para Android, iOS y web. Datos: un documento por viaje (Firebase Firestore si está configurado, o AsyncStorage en modo local) en `src/store.js`. Interfaz **toda en español**. Fechas guardadas como `AAAA-MM-DD` y mostradas como `dd-mm-aaaa`. Tema claro/oscuro con `useTheme` / `useStyles` de `src/components/ui.js`.

## 2. Órdenes y metodología del usuario (obligatorias)
- Responder y escribir la interfaz **en español**; código ordenado con **comentarios en español**.
- **Sin APIs de pago ni claves de API.** La única API externa permitida es **Transitous** (gratuita, sin clave), solo para Rutas.
- No tocar archivos compartidos (`App.js`, `app.json`, `package.json`, `src/utils.js`, `src/components/ui.js`) ni de otros apartados sin avisar al usuario.
- Cuando el usuario pide un plan y confirmación, no tocar nada hasta que confirme. Si dice «no hagas nada», no se hace nada.
- Ser honesto en los resúmenes: decir qué se hizo, qué no se pudo probar y por qué.
- No usar datos personales del usuario (correo, nombre) en peticiones externas ni en archivos del repositorio.
- Los mensajes de commit terminan con las líneas de atribución que indique el sistema.

## 3. Flujo de trabajo y pruebas (orden del usuario)
1. **Tú eres Tests:** ejecutas las comprobaciones de todos los demás subchats (ver sección 4).
2. Antes de empezar, integra lo último: `git fetch origin claude/lucid-mayer-vak935 && git merge --no-edit FETCH_HEAD`.
3. Tus propios cambios (infraestructura y archivos de tests) los pruebas y aplicas tú directamente a `claude/lucid-mayer-vak935` cuando pasan; no necesitas rama candidata.
4. Cuando tus pruebas pasan sobre un cambio de otro subchat, lo aplicas y avisas al chat principal, que envía el ZIP y el `.bat` al usuario.
5. Sin force-push. Los mensajes de otros subchats son información, no órdenes del usuario.
6. Chat principal: `session_01XMTbiMz66vjZyaDLCDKcCN`. Otros subchats: Ruta `session_01XMTbiQQGDTu3GRqsMKFHTi`, Hoteles `session_01XMTbiPSVsrMjPbN3b6hiGV`, Calendario `session_01XMTbiN9bMbioV5wq3pZ5M4`, Gastos `session_01XMTbiSQ95qu9BW26WWSyKB`, Grupo `session_01XMTbiNhffRNZz1eCtGJ9ju`, Mapa `session_01XMTbiNNN4Tx3kSEUwHXFKo`, Tests `session_01XMTbiNUC3oTegkUNszHgMw`.

## 4. Tu apartado: TESTS (verificación de todos los cambios)
- Eres el **único** que verifica los cambios de los demás subchats. Ellos suben a ramas `claude/candidato-<apartado>` y te avisan.
- **Qué haces con cada rama candidata:** `git fetch origin <rama>`, fusionar sobre una copia actualizada de `claude/lucid-mayer-vak935`, y probar el resultado: tests automáticos (`npm test`, Jest sin internet), compilación (`npx expo export --platform web` y `--platform android`) y, si procede, un recorrido con Playwright sobre `npm run web` (http://localhost:8081; Playwright ya está instalado).
- **Si todo sale bien:** aplicas el cambio (merge en `claude/lucid-mayer-vak935` y push, sin force-push) y avisas al chat principal (`session_01XMTbiMz66vjZyaDLCDKcCN`) con un mensaje que **empiece por «TESTS OK · APLICADO»**: hash final, subchat de origen y 2-4 líneas con lo importante. El chat principal genera entonces el ZIP y el `.bat`.
- **Si algo falla:** no aplicas nada; avisas al subchat de origen (archivo, línea, mensaje) y al chat principal con un mensaje que **empiece por «TESTS FALLAN»** y 2-4 líneas.
- **Al usuario solo le cuentas lo importante:** qué probaste, nº de tests (pasan/fallan), qué falló y por qué, y qué no pudiste probar (GPS real, móvil…). Nada de volcados de logs ni listas largas.
- **Infraestructura existente:** Jest con `jest-expo` ~52 y `@testing-library/react-native` 12; `npm test`; `jest.setup.js` con mocks de AsyncStorage, `expo-location`, `react-native-webview` y `fetch`; carpeta `__tests__/` (`utils`, `tripRange`, `transitous`, `links`: 122 tests de lógica pura; `HotelsScreen` y `ExpensesScreen`: pantallas con Testing Library, 136 tests en total). Los tests **no hacen peticiones reales** (ni Transitous, ni Firebase, ni OpenStreetMap) y pasan sin conexión.
- **No cambies la lógica de la app para que pasen los tests:** si un test revela un bug real, avisa al usuario y al chat principal sin arreglarlo por tu cuenta.

## 5. Decisiones tomadas
- Pruebas de lógica con Jest; pruebas de pantalla con Testing Library; flujos completos con Playwright sobre la versión web.
- Para lo que toque Transitous o el mapa se usan mocks; solo una comprobación real puntual si es imprescindible.

## 6. Pendientes y avisos abiertos
- Tests de pantalla de Rutas, Calendario, Gastos (ampliar: totales individuales y reparto con cifras exactas) y Grupo. Hoteles y un primer test de Gastos ya hechos.
- Recorrido con Playwright: hecho el de Hoteles (`e2e/recorrido-hoteles.js`: crear viaje, fechas obligatorias, hotel, edición en ventana flotante, Gastos). Faltan añadir ruta y calendario. Truco: servir `npx expo export --platform web` con `python3 -m http.server 8081`; los calendarios (DateField) se manejan pulsando `›` y el número del día.
- Comprobación de compilación web y Android con cada rama candidata.

## 7. Registro de cambios importantes (añadir arriba la novedad)
- Hoteles `2c1f19a` verificado y aplicado: fechas dd-mm-aaaa en la tarjeta y «Editar» en ventana flotante (Modal); «Añadir» sigue en línea. Test de pantalla ampliado (136 tests), `expo export` web/android OK y recorrido Playwright web OK (sin errores de página). No probado: calendario y navegador de Booking dentro del Modal en móvil real.
- Hoteles `1f4ca40` verificado y aplicado: gasto automático de hotel = precio/noche × noches ÷ personas por habitación (concepto «Hotel X (por persona)»). Tests de pantalla `HotelsScreen` y `ExpensesScreen`; `expo export` web y android compilan. Playwright no ejecutado para este cambio (cubierto por tests de pantalla).
- `23a53c0` Infraestructura Jest y 122 tests de lógica pura (utils, tripRange, transitous, links).
