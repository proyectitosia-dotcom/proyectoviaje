// Mapa en móvil: WebView con Leaflet. Se controla con el ref (post).
// Si la WebView falla o se cae su proceso (p. ej. por poca memoria), se muestra un aviso
// con "Reintentar" en vez de cerrar la app.
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Btn, Muted } from './ui';
import { MAP_HTML } from './mapHtml';

const MapView = forwardRef(function MapView({ onMessage, style }, ref) {
  const web = useRef(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0); // al cambiar, la WebView se vuelve a crear
  // Enviar un mensaje al mapa ejecutando JS dentro de la WebView
  useImperativeHandle(ref, () => ({
    post: (m) => { try { web.current && web.current.injectJavaScript(`window.__fromRN && window.__fromRN(${JSON.stringify(m)}); true;`); } catch (e) { /* ignorar */ } },
  }));
  const retry = () => { setFailed(false); setVersion((v) => v + 1); };
  if (failed) {
    return (
      <View style={[{ alignItems: 'center', justifyContent: 'center', padding: 20 }, style]}>
        <Muted>No se pudo cargar el mapa. Comprueba tu conexión.</Muted>
        <Btn small title="Reintentar" onPress={retry} />
      </View>
    );
  }
  return (
    <WebView
      key={version}
      ref={web}
      style={style}
      originWhitelist={['*']}
      source={{ html: MAP_HTML, baseUrl: 'https://proyectoviaje.app/' }}
      javaScriptEnabled
      domStorageEnabled
      onError={() => setFailed(true)}
      onRenderProcessGone={retry}
      onContentProcessDidTerminate={retry}
      onMessage={(e) => { try { onMessage(JSON.parse(e.nativeEvent.data)); } catch (err) { /* mensaje no válido */ } }}
    />
  );
});
export default MapView;
