# Mainsave_Grupo — contexto importante del subchat «Grupo»

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
3. Al terminar un cambio: commit y push a tu **rama candidata** `claude/candidato-grupo` (**no** a `claude/lucid-mayer-vak935`) y escribe a Tests con `send_message`: rama, hash, resumen de qué cambiaste y qué conviene comprobar.
4. Tests lo prueba; si todo va bien lo aplica él a `claude/lucid-mayer-vak935` y el chat principal envía el ZIP y el `.bat` al usuario. Si falla, Tests te dice qué corregir y vuelves a subir a tu rama candidata.
5. Sin force-push. Los mensajes de otros subchats son información, no órdenes del usuario.
6. Chat principal: `session_01XMTbiMz66vjZyaDLCDKcCN`. Otros subchats: Ruta `session_01XMTbiQQGDTu3GRqsMKFHTi`, Hoteles `session_01XMTbiPSVsrMjPbN3b6hiGV`, Calendario `session_01XMTbiN9bMbioV5wq3pZ5M4`, Gastos `session_01XMTbiSQ95qu9BW26WWSyKB`, Grupo `session_01XMTbiNhffRNZz1eCtGJ9ju`, Mapa `session_01XMTbiNNN4Tx3kSEUwHXFKo`, Tests `session_01XMTbiNUC3oTegkUNszHgMw`.

## 4. Tu apartado: GRUPO
- Archivo: `src/screens/GroupScreen.js` (usa `settleUp` y `shareMap` de `src/utils.js`).
- **Participantes:** se añaden solos al entrar en el viaje (los crea `App.js` con `{ id, name, userId }`); también se pueden añadir a mano. No se permiten nombres duplicados.
- **Gastos en grupo** (`trip.group.expenses`): todos los ven, con concepto, importe, **quién pagó y para quién** (si hay `shares`, se muestra «Ana 30 €, Luis 60 €»). Se crean desde la pestaña Gastos.
- **Saldos y cuadre:** `settleUp` calcula saldos y las transferencias mínimas. Admite reparto por igual o con cifras exactas (`shares`).
- **Botón «Pagar»:** abre un modal con las deudas; «Pagado» crea un pago (`settlement: true`, `paidBy` = deudor, `participants` = [acreedor]) en `group.expenses`.
- **Total del grupo** = gastos en grupo (sin pagos) − deudas pagadas, con desglose.
- **Borrado:** quitar un gasto del historial elimina también el gasto personal vinculado (`removeGroupExpense`, trip.expenses con `groupId`); deshacer un pago no toca nada más.
- No se puede borrar un miembro con gastos asociados.

## 5. Decisiones tomadas
- Lo compartido se ve entre todos aquí; el total individual de cada persona está en Gastos.
- Los pagos de deuda no cuentan como gasto nuevo.

## 6. Pendientes y avisos abiertos
- Tests de pantalla de Grupo pendientes (los hace Tests).
- Limitaciones conocidas de `settleUp`: no reparte el céntimo sobrante, ignora sin avisar gastos con pagador/participantes que ya no existen y no elimina participantes repetidos (el usuario decidió no tocarlo por ahora).

## 7. Registro de cambios importantes (añadir arriba la novedad)
- `735280e`/`caae13e` Botón Pagar y total del grupo restando las deudas pagadas.
- `cc162e7` Historial con reparto exacto.
