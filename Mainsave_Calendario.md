# Mainsave_Calendario — contexto importante del subchat «Calendario»

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
3. Al terminar un cambio: commit y push a tu **rama candidata** `claude/candidato-calendario` (**no** a `claude/lucid-mayer-vak935`) y escribe a Tests con `send_message`: rama, hash, resumen de qué cambiaste y qué conviene comprobar.
4. Tests lo prueba; si todo va bien lo aplica él a `claude/lucid-mayer-vak935` y el chat principal envía el ZIP y el `.bat` al usuario. Si falla, Tests te dice qué corregir y vuelves a subir a tu rama candidata.
5. Sin force-push. Los mensajes de otros subchats son información, no órdenes del usuario.
6. Chat principal: `session_01XMTbiMz66vjZyaDLCDKcCN`. Otros subchats: Ruta `session_01XMTbiQQGDTu3GRqsMKFHTi`, Hoteles `session_01XMTbiPSVsrMjPbN3b6hiGV`, Calendario `session_01XMTbiN9bMbioV5wq3pZ5M4`, Gastos `session_01XMTbiSQ95qu9BW26WWSyKB`, Grupo `session_01XMTbiNhffRNZz1eCtGJ9ju`, Mapa `session_01XMTbiNNN4Tx3kSEUwHXFKo`, Tests `session_01XMTbiNUC3oTegkUNszHgMw`.

## 4. Tu apartado: CALENDARIO
- Archivo: `src/screens/CalendarScreen.js` (usa `src/tripRange.js` para los días y `src/links.js` para abrir ubicaciones).
- **Primera vez:** pantalla «Crear tu calendario». Al terminar («Terminar y guardar como Mi viaje») se marca `trip.calendarCreated = true`.
- **Después:** se abre directamente **«Mi viaje»**: una agenda parecida a Google Calendar con los días del viaje, los eventos ordenados por hora, el plan de cada día desplegable («Ver plan del día»), y arriba las fechas de inicio y fin. Botón «Editar calendario».
- Los días del calendario son **solo los del rango del viaje** (`daysInRange(startDate, endDate)`); ya no hay «añadir/quitar día». Cada día se guarda en `trip.days` con su `date` (`AAAA-MM-DD`); los días antiguos (solo `number`) se enlazan a su fecha según el inicio del viaje, y los que quedan fuera del rango se conservan ocultos.
- Cada día: plan de texto, eventos (`id`, `title`, `time` HH:MM opcional, `place`, `mapUrl`) y rutas asignadas (`routeIds`, de todas las secciones de Ruta).
- **Ubicación en los eventos:** campo opcional para pegar un enlace de Google Maps (validado con `isMapsLink`); el botón «Ver en Google Maps» solo aparece si el evento tiene enlace y se abre con `openExternal` (app de Google Maps si está instalada, si no el navegador). Los eventos se pueden **editar**.
- Persistencia: todo se guarda en el documento del viaje (`update({ days })`).

## 5. Decisiones tomadas
- Los días los define el rango del viaje (cambiar las fechas cambia los días visibles).

## 6. Pendientes y avisos abiertos
- Tests de pantalla del Calendario pendientes (los hace Tests).

## 7. Registro de cambios importantes (añadir arriba la novedad)
- `4708ae2` Calendario: «Crear tu calendario» y «Mi viaje», días = rango del viaje, ubicación en eventos y edición de eventos.
