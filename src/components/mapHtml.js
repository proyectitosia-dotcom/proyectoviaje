// HTML de Leaflet que se carga dentro de la WebView (móvil) o de un iframe (web).
// Sin claves de API: teselas de OpenStreetMap y Leaflet por CDN con versión fija.
//
// Protocolo de mensajes (JSON):
//   Mapa -> app:  { type:'ready' } | { type:'tap', lat, lng }
//   App -> mapa:  { type:'user', lat, lng, accuracy } | { type:'center', lat, lng, zoom }
//                 | { type:'marker', lat, lng } | { type:'clear' }
export const LEAFLET_VERSION = '1.9.4';

export const MAP_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css">
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  .pin { font-size: 30px; line-height: 30px; text-shadow: 0 1px 3px rgba(0,0,0,.5); }
  #err { display:none; position:absolute; z-index:1000; top:50%; left:0; right:0; text-align:center;
         font: 14px sans-serif; color:#555; padding:16px; }
</style>
</head><body>
<div id="map"></div>
<div id="err">No se pudo cargar el mapa. Revisa tu conexión a internet.</div>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<script>
(function () {
  // Envía un mensaje a la app (WebView nativa o página padre en web)
  function send(m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
    else if (window.parent !== window) window.parent.postMessage(m, '*');
  }
  if (!window.L) { document.getElementById('err').style.display = 'block'; return; }

  var map = L.map('map', { zoomControl: true }).setView([40.4168, -3.7038], 5);
  // Atribución obligatoria de OpenStreetMap, siempre visible
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  // Texto exacto pedido: "© OpenStreetMap contributors" (con enlace a copyright)
  map.attributionControl.removeAttribution('&copy; OpenStreetMap contributors');
  map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>');

  var userDot = null, userCircle = null, picked = null;

  map.on('click', function (e) {
    setMarker(e.latlng.lat, e.latlng.lng);
    send({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng });
  });

  function setMarker(lat, lng) {
    if (picked) picked.setLatLng([lat, lng]);
    else picked = L.marker([lat, lng], {
      icon: L.divIcon({ className: '', html: '<div class="pin">📍</div>', iconSize: [30, 30], iconAnchor: [15, 29] })
    }).addTo(map);
  }

  function handle(m) {
    if (m.type === 'user') {
      var ll = [m.lat, m.lng];
      if (!userDot) {
        userCircle = L.circle(ll, { radius: m.accuracy || 20, color: '#1E6FD9', weight: 1, fillOpacity: 0.12 }).addTo(map);
        userDot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1E6FD9', fillOpacity: 1 }).addTo(map);
      } else { userDot.setLatLng(ll); userCircle.setLatLng(ll); if (m.accuracy) userCircle.setRadius(m.accuracy); }
    } else if (m.type === 'center') {
      map.setView([m.lat, m.lng], m.zoom || Math.max(map.getZoom(), 15));
    } else if (m.type === 'marker') { setMarker(m.lat, m.lng); }
    else if (m.type === 'clear' && picked) { map.removeLayer(picked); picked = null; }
  }

  // Mensajes de la app: window (iframe/iOS) y document (Android)
  function onMsg(ev) {
    try { handle(typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data); } catch (e) {}
  }
  window.addEventListener('message', onMsg);
  document.addEventListener('message', onMsg);
  window.__fromRN = handle; // alternativa: injectJavaScript
  send({ type: 'ready' });
})();
</script>
</body></html>`;
