# Mainsave_Gastos — contexto importante del subchat «Gastos»

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
3. Al terminar un cambio: commit y push a tu **rama candidata** `claude/candidato-gastos` (**no** a `claude/lucid-mayer-vak935`) y escribe a Tests con `send_message`: rama, hash, resumen de qué cambiaste y qué conviene comprobar.
4. Tests lo prueba; si todo va bien lo aplica él a `claude/lucid-mayer-vak935` y el chat principal envía el ZIP y el `.bat` al usuario. Si falla, Tests te dice qué corregir y vuelves a subir a tu rama candidata.
5. Sin force-push. Los mensajes de otros subchats son información, no órdenes del usuario.
6. Chat principal: `session_01XMTbiMz66vjZyaDLCDKcCN`. Otros subchats: Ruta `session_01XMTbiQQGDTu3GRqsMKFHTi`, Hoteles `session_01XMTbiPSVsrMjPbN3b6hiGV`, Calendario `session_01XMTbiN9bMbioV5wq3pZ5M4`, Gastos `session_01XMTbiSQ95qu9BW26WWSyKB`, Grupo `session_01XMTbiNhffRNZz1eCtGJ9ju`, Mapa `session_01XMTbiNNN4Tx3kSEUwHXFKo`, Tests `session_01XMTbiNUC3oTegkUNszHgMw`.

## 4. Tu apartado: GASTOS
- Archivo: `src/screens/ExpensesScreen.js` (usa `shareMap` de `src/utils.js` y `useMe` de `src/user.js`).
- **Parte superior:** solo el número **«Mi total gastado»**. Debajo, **«Mi resumen de gastos»** con: *Total de mis gastos*, *Pagados por mí en grupo* (+) y *Dinero que me han pagado* (−), y las categorías con barras y porcentaje.
- **Mi total** = gastos propios (+ coste automático de hoteles y rutas) + gastos de grupo que he pagado − dinero que me han pagado. Lo cobrado se resta de la categoría correspondiente (reparto proporcional a lo que cada persona debía en cada categoría).
- Categorías: vuelo, transporte, comida, hoteles, entradas, otros. Se puede **cambiar el tipo** de cualquier gasto («🏷️ Cambiar tipo»).
- Cada gasto guarda autor (`by`, `byName`): solo el autor puede borrarlo o cambiar su tipo; los antiguos sin autor los puede borrar cualquiera.
- «Mis movimientos» muestra solo mis gastos personales (sin vínculo de grupo). Los **gastos en grupo** (formulario propio) se guardan en Gastos y en Grupo, vinculados por `groupId`, y se ven entre todos.
- **Reparto de un gasto de grupo:** por igual o con **cifras exactas** en € por persona (`group.expenses[].shares`); el selector valida que sumen el total.
- **Divisas:** los importes se guardan siempre en euros; cambio editable y actualizado solo desde el BCE (Frankfurter) con respaldo open.er-api.com.
- Los costes de hoteles (`hotelId`/`fromHotels`) y de rutas (`fromRoutes`) se reflejan solos en el resumen. Los costes de «Otras rutas» también suman.
- El selector de fecha de los gastos solo permite días dentro del rango del viaje.
- Borrar un gasto en grupo desde Grupo borra también el personal vinculado (lo gestiona `GroupScreen.js`).

## 5. Decisiones tomadas
- Totales y resumen **individuales**; lo compartido vive en la pestaña Grupo.
- Quitar un gasto de grupo con «Quitar» lo deja en Gastos como personal; borrarlo del historial de Grupo lo elimina del todo.

## 6. Pendientes y avisos abiertos
- Tests de pantalla de Gastos pendientes (los hace Tests).

## 7. Registro de cambios importantes (añadir arriba la novedad)
- `cc162e7` Reparto con cifras exactas y lo cobrado se resta de su categoría.
- `a8cef34` Cambio de tipo de gasto, borrado enlazado y resumen reorganizado.
- `f8ea3cd` Mi total suma lo pagado en grupo y resta lo devuelto.
