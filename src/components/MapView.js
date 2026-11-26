// Mapa en web: iframe con el mismo HTML de Leaflet, comunicado por postMessage.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MAP_HTML } from './mapHtml';

const MapView = forwardRef(function MapView({ onMessage, style }, ref) {
  const frame = useRef(null);
  useImperativeHandle(ref, () => ({
    post: (m) => frame.current && frame.current.contentWindow && frame.current.contentWindow.postMessage(m, '*'),
  }));
  useEffect(() => {
    // Solo mensajes que vengan de nuestro iframe
    const h = (e) => { if (frame.current && e.source === frame.current.contentWindow && e.data && e.data.type) onMessage(e.data); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [onMessage]);
  return <iframe ref={frame} title="Mapa" srcDoc={MAP_HTML} style={{ border: 0, width: '100%', height: '100%', ...(style || {}) }} />;
});
export default MapView;
