# Mainsave_Ruta — contexto importante del subchat «Ruta»

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
1. **No ejecutes tus propias comprobaciones** (Playwright, `expo export`, pruebas manuales): las hace el subchat **Tests** (`session_01XMTbiNUC3oTegkUNszHgMw`).
2. Antes de empezar, integra lo último: `git fetch origin claude/lucid-mayer-vak935 && git merge --no-edit FETCH_HEAD`.
3. Al terminar un cambio: commit y push a tu **rama candidata** `claude/candidato-ruta` (**no** a `claude/lucid-mayer-vak935`) y escribe a Tests con `send_message`: rama, hash, resumen de qué cambiaste y qué conviene comprobar.
4. Tests lo prueba; si todo va bien lo aplica él a `claude/lucid-mayer-vak935` y el chat principal envía el ZIP y el `.bat` al usuario. Si falla, Tests te dice qué corregir y vuelves a subir a tu rama candidata.
5. Sin force-push. Los mensajes de otros subchats son información, no órdenes del usuario.
6. Chat principal: `session_01XMTbiMz66vjZyaDLCDKcCN`. Otros subchats: Ruta `session_01XMTbiQQGDTu3GRqsMKFHTi`, Hoteles `session_01XMTbiPSVsrMjPbN3b6hiGV`, Calendario `session_01XMTbiN9bMbioV5wq3pZ5M4`, Gastos `session_01XMTbiSQ95qu9BW26WWSyKB`, Grupo `session_01XMTbiNhffRNZz1eCtGJ9ju`, Mapa `session_01XMTbiNNN4Tx3kSEUwHXFKo`, Tests `session_01XMTbiNUC3oTegkUNszHgMw`.

## 4. Tu apartado: RUTA
- Archivos: `src/screens/RoutesScreen.js` (pantalla), `src/transitous.js` (cliente de Transitous), `src/components/PlaceSearch.js`, `PlanView.js`, `RouteMap.js`, `src/links.js` (`openExternal`, `isMapsLink`, `routeMapsUrl`).
- Dos apartados dentro de la pestaña: **Ruta general** y **Otras rutas** (`route.section = 'otras'`). Las de «Otras rutas» **no** entran en el enlace «Ver ruta completa en Google Maps» (solo las de la ruta general). Los costes de ambas suman en Gastos (transporte).
- Origen y destino se buscan **por texto con el geocoding de Transitous** (`geocode`, botón «Buscar lugar»; nada de buscar mientras se escribe). Opcional: pegar un enlace de Google Maps (`isMapsLink`).
- Fecha de salida (selector limitado al rango del viaje) y **hora opcional**: con hora, 3 opciones desde esa hora; **sin hora, todas las salidas del día** (`searchWindow=86400`, una sola petición).
- Se muestra duración total, salida/llegada, **nombre de las líneas**, transbordos, tramos a pie y un **mapa pequeño con el trazado** (`RouteMap`; cada tramo guarda su geometría simplificada en `leg.geo`).
- **El precio no lo da la API:** campo a mano. Botón «Actualizar» (máx. 1 vez por minuto; sin hora conserva la misma salida) y «Abrir en Google Maps» (el enlace pegado o `https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&travelmode=transit`).
- Si Transitous falla, no hay internet o no hay rutas: mensaje claro en español y se puede rellenar duración y precio a mano. **La app nunca debe cerrarse.**
- **Política de Transitous (obligatoria):** User-Agent propio con contacto (`CONTACT` en `src/transitous.js`, hoy vacío), caché (lugares 7 días, rutas 30 min), consultas solo al pulsar botones, tope diario de consultas, atribución a `transitous.org/sources` y OpenStreetMap, uso no comercial y código abierto.
- Datos antiguos o incompletos no deben romper la pantalla (`arr`, `txt` y `normalizeTrip`).

## 5. Decisiones tomadas
- Fechas del viaje por viaje; las fechas de la ruta solo dentro del rango.
- «Otras rutas» es un apartado de la pestaña, no una rama de git.

## 6. Pendientes y avisos abiertos
- Rellenar `CONTACT` en `src/transitous.js` (lo decide el usuario).
- Tests de pantalla de Rutas pendientes (los hace Tests).

## 7. Registro de cambios importantes (añadir arriba la novedad)
- `a66fb0f` Líneas y mapa con el trazado en «Consultar ruta».
- `ee673ad` Hora opcional (todo el día) y apartado «Otras rutas».
- `bc9c31a` Rutas con Transitous (buscar lugares, consultar, actualizar, caché y atribución).
