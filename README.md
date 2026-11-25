# ✈️ Proyecto Viaje

App móvil (Android e iOS) para organizar un viaje a cualquier país, compartirlo con otras personas y editarlo entre todos en tiempo real.

Hecha con **Expo / React Native**, con **Firebase Firestore** para la sincronización.

## Apartados

| Pestaña | Qué hace |
|---|---|
| 🗺️ **Ruta** | Trayectos con origen, paradas, destino, fecha y hora de salida, duración, coste, tipos de transporte y líneas. Cada trayecto tiene su enlace a Google Maps con la ruta y las paradas ya creadas, y hay otro enlace con la ruta completa del viaje. |
| 🏨 **Hoteles** | Busca en Booking.com por ciudad, fechas, personas y habitaciones. Al guardar el hotel muestra cada día de estancia, el precio por noche, el precio por persona (por noche y por estancia), las personas por habitación, el nº de habitaciones, la hora del check-in y los enlaces a Booking y a Google Maps. |
| 📅 **Calendario** | Días del 1 al 30 (se pueden añadir o quitar), con fecha real a partir del día de inicio. Cada día tiene un plan editable, eventos con hora y lugar, y las rutas que elijas de la pestaña Ruta. |
| 💶 **Gastos** | Vuelo, transporte, comida, entradas y otros, con totales y porcentajes. Puedes importar el coste de las rutas y de los hoteles. |
| 👥 **Grupo** | Participantes y gastos compartidos (quién pagó y para quién). Calcula los saldos y el mínimo de pagos para cuadrar las cuentas. |

**Compartir:** cada viaje tiene un código de 6 caracteres. Con el botón *Compartir* lo envías por WhatsApp, email, etc., y los demás entran desde *Unirse a un viaje*. Los cambios aparecen en todos los móviles al instante.

## Puesta en marcha

```bash
npm install
npx expo start
```
Escanea el QR con **Expo Go** (Android o iOS).

### Windows: doble clic
1. Instala [Node.js LTS](https://nodejs.org).
2. Descarga el proyecto (con `git clone` o en ZIP desde GitHub) y descomprímelo.
3. Haz doble clic en **`Iniciar Proyecto Viaje.bat`**: instala lo necesario la primera vez y abre la app en el navegador.

### Ejecutar en el ordenador (navegador)
```bash
npm run web
```
Se abre en http://localhost:8081. Al guardar un archivo, la página se recarga sola con los cambios. Consejo: en Chrome pulsa F12 y activa la vista de móvil (Ctrl+Shift+M) para verla con tamaño de teléfono.

### Activar la compartición en tiempo real (Firebase, gratis)
1. Crea un proyecto en https://console.firebase.google.com
2. Pulsa *Añadir app → Web* y copia la configuración en `src/firebaseConfig.js`.
3. Activa *Firestore Database* y pega en *Reglas* el contenido de `firestore.rules`.

Si Firebase no está configurado, la app funciona en **modo local** (los datos se guardan solo en el móvil).

### Generar las apps instalables
```bash
npm i -g eas-cli && eas build -p android   # .apk/.aab
eas build -p ios                           # requiere cuenta Apple Developer
```

## Nota sobre Booking.com
Booking.com no tiene una API pública abierta. Su API para socios (Demand API) exige ser afiliado aprobado. Por eso la app abre la búsqueda de Booking ya filtrada por ciudad, fechas, personas y habitaciones. Tú eliges el hotel, pegas su enlace y su precio en la app, y ella calcula todo lo demás. Si consigues acceso a la API de afiliados, se puede integrar en `src/screens/HotelsScreen.js`.

## Seguridad
Las reglas incluidas dejan leer y editar un viaje a cualquiera que conozca su código. Para más control, añade Firebase Authentication y limita el acceso a los miembros del viaje.
