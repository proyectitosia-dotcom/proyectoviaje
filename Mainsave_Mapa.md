# Mainsave_Mapa — contexto importante del subchat «Mapa»

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
3. Al terminar un cambio: commit y push a tu **rama candidata** `claude/candidato-mapa` (**no** a `claude/lucid-mayer-vak935`) y escribe a Tests con `send_message`: rama, hash, resumen de qué cambiaste y qué conviene comprobar.
4. Tests lo prueba; si todo va bien lo aplica él a `claude/lucid-mayer-vak935` y el chat principal envía el ZIP y el `.bat` al usuario. Si falla, Tests te dice qué corregir y vuelves a subir a tu rama candidata.
5. Sin force-push. Los mensajes de otros subchats son información, no órdenes del usuario.
6. Chat principal: `session_01XMTbiMz66vjZyaDLCDKcCN`. Otros subchats: Ruta `session_01XMTbiQQGDTu3GRqsMKFHTi`, Hoteles `session_01XMTbiPSVsrMjPbN3b6hiGV`, Calendario `session_01XMTbiN9bMbioV5wq3pZ5M4`, Gastos `session_01XMTbiSQ95qu9BW26WWSyKB`, Grupo `session_01XMTbiNhffRNZz1eCtGJ9ju`, Mapa `session_01XMTbiNNN4Tx3kSEUwHXFKo`, Tests `session_01XMTbiNUC3oTegkUNszHgMw`.

## 4. Tu apartado: MAPA
- Archivos: `src/screens/MapScreen.js`, `src/components/MapView.js` (web: iframe) y `MapView.native.js` (móvil: `react-native-webview`), `src/components/mapHtml.js` (HTML de Leaflet), `src/vendor/leafletSource.js` (Leaflet **empaquetado en la app, sin CDN**, generado con `scripts/genLeaflet.js`; archivo generado y commiteado) y `RouteMap.js` (mini-mapa de rutas que reutiliza este mapa).
- **Requisito: nada de APIs de pago ni claves.** Mapa de OpenStreetMap (teselas `https://tile.openstreetmap.org/{z}/{x}/{y}.png`) con Leaflet. Atribución obligatoria **«© OpenStreetMap contributors»** (texto exacto, en inglés a propósito).
- **Ubicación en tiempo real** con `expo-location`: permisos con mensaje claro (`app.json`: plugin expo-location, `NSLocationWhenInUseUsageDescription`, `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`), marcador azul que se actualiza en directo, botón «📍 Mi ubicación», aviso (sin fallar) si no hay permiso o el GPS está apagado.
- **Buscador:** abre Google Maps con `https://www.google.com/maps/search/?api=1&query=TEXTO_CODIFICADO` y botón «Buscar en Waze» con `https://waze.com/ul?q=TEXTO_CODIFICADO`. No abre nada con el texto vacío.
- **Tocar el mapa:** coloca un marcador y muestra «Cómo llegar» → elegir entre Google Maps (`…/dir/?api=1&destination=LAT,LNG`) y Waze (`https://waze.com/ul?ll=LAT,LNG&navigate=yes`) con un selector propio (Alert.alert no funciona en web).
- iOS: `LSApplicationQueriesSchemes` con `comgooglemaps` y `waze`.
- **Protocolo de mensajes** app↔mapa (`mapHtml.js`): `ready`, `tap`, `user`, `center`, `marker`, `clear` y **`route`** (`{ legs:[{mode,pts}], points:[{lat,lng,name,kind}] }`, dibuja una ruta y encuadra; en ese modo tocar no coloca marcador). No quitar `route`: lo usa `RouteMap`.
- Control de errores: la ubicación y la WebView no deben cerrar la app (aviso con «Reintentar» si la WebView falla o se cae).
- Controles de zoom con textos en español («Acercar» / «Alejar»).

## 5. Decisiones tomadas
- Leaflet en WebView/iframe (no `react-native-maps` ni MapLibre nativo) por no necesitar clave y funcionar en Expo Go.
- Las teselas siguen necesitando internet.

## 6. Pendientes y avisos abiertos
- **No reproducido:** el usuario reportó que el Mapa se cerraba en el móvil; en web funciona. Se añadió control de errores. Si vuelve a fallar, hace falta el texto del error, Android/iOS y Expo Go o app compilada.
- GPS real y permisos sin probar en un dispositivo real.

## 7. Registro de cambios importantes (añadir arriba la novedad)
- `a66fb0f` Mensaje `route` para dibujar rutas y zoom en español.
- `c3037f1` Control de errores en ubicación y WebView (reintento).
- `ad17ac6` Leaflet empaquetado, sin CDN.
- `6805de7` Pestaña Mapa.
