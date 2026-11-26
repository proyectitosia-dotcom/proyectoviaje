// Mapa en móvil: WebView con Leaflet. Se controla con el ref (center/user/clear).
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { MAP_HTML } from './mapHtml';

const MapView = forwardRef(function MapView({ onMessage, style }, ref) {
  const web = useRef(null);
  // Enviar un mensaje al mapa ejecutando JS dentro de la WebView
  useImperativeHandle(ref, () => ({
    post: (m) => web.current && web.current.injectJavaScript(`window.__fromRN && window.__fromRN(${JSON.stringify(m)}); true;`),
  }));
  return (
    <WebView
      ref={web}
      style={style}
      originWhitelist={['*']}
      source={{ html: MAP_HTML, baseUrl: 'https://proyectoviaje.app/' }}
      javaScriptEnabled
      domStorageEnabled
      onMessage={(e) => { try { onMessage(JSON.parse(e.nativeEvent.data)); } catch {} }}
    />
  );
});
export default MapView;
