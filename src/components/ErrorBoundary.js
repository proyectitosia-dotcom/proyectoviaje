// Control de errores: si una pantalla falla al dibujarse, se muestra un mensaje con
// el motivo y un botón "Reintentar" en vez de cerrar toda la app.
// Además, GlobalErrorBanner avisa de los errores que ocurren FUERA del dibujado
// (botones, promesas, ubicación...), que en móvil cerrarían la app.
import React from 'react';
import { View, Platform } from 'react-native';
import { Btn, Card, H, Muted, Text, useTheme } from './ui';

// Explica un error en español (los mensajes técnicos de las librerías vienen en inglés)
export function describeError(e) {
  const raw = String((e && e.message) || e || '');
  const l = `${raw} ${(e && e.code) || ''}`.toLowerCase();
  if (/permission-denied|insufficient permissions/.test(l)) return 'No tienes permiso para hacer esto.';
  if (/unavailable|network|failed to fetch|offline|timeout|timed out/.test(l)) return 'Parece que no hay conexión a internet.';
  if (/not-found/.test(l)) return 'No se ha encontrado lo que se buscaba.';
  if (/quota|resource-exhausted/.test(l)) return 'Se ha superado el límite del servicio. Inténtalo más tarde.';
  if (/cannot read propert|undefined is not|is not a function|is not an object|null is not|is undefined/.test(l)) return 'Ha ocurrido un fallo inesperado en la app.';
  return 'Ha ocurrido un error inesperado.';
}

// ---- Registro global de errores (para el aviso superior) ----
const listeners = new Set();
let lastError = null;

export function reportError(e) {
  const msg = describeError(e);
  lastError = msg;
  // En desarrollo se sigue viendo en la consola / terminal de Expo
  // eslint-disable-next-line no-console
  console.warn('[Proyecto Viaje] Error capturado:', e);
  listeners.forEach((l) => l(msg));
}

// Se instala una sola vez al arrancar la app
let installed = false;
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.addEventListener('error', (ev) => reportError(ev.error || ev.message));
        window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
      }
    } else if (typeof global !== 'undefined' && global.ErrorUtils) {
      // En móvil: un error no capturado cerraría la app. Lo mostramos como aviso.
      const previous = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        reportError(error);
        // En desarrollo se conserva el comportamiento normal (pantalla roja con detalles)
        if (__DEV__ && previous) previous(error, isFatal);
      });
    }
  } catch (e) { /* si no se puede instalar, la app sigue funcionando igual */ }
}

// Aviso superior con el último error (se puede cerrar)
export function GlobalErrorBanner() {
  const { colors } = useTheme();
  const [msg, setMsg] = React.useState(lastError);
  React.useEffect(() => {
    const l = (m) => setMsg(m);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  if (!msg) return null;
  return (
    <View style={{ backgroundColor: colors.danger, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ flex: 1, color: '#fff', fontSize: 13 }}>⚠️ {msg}</Text>
      <Text style={{ color: '#fff', fontWeight: '700', padding: 6 }} onPress={() => { lastError = null; setMsg(null); }}>Cerrar</Text>
    </View>
  );
}

// Pantalla de error (componente de función para poder usar el tema)
function ErrorView({ error, onRetry, title }) {
  return (
    <View style={{ padding: 16 }}>
      <Card>
        <H>{title || 'Algo ha fallado en esta pantalla'}</H>
        <Muted>La app sigue funcionando. Puedes reintentar o cambiar de pestaña.</Muted>
        <Text style={{ marginVertical: 8 }}>{describeError(error)}</Text>
        <Muted>Detalle técnico (por si hay que corregirlo): {String((error && error.message) || error)}</Muted>
        <Btn title="Reintentar" onPress={onRetry} />
      </Card>
    </View>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    // (la propia pantalla de error ya muestra el motivo; solo se deja constancia en la consola)
    // eslint-disable-next-line no-console
    console.warn('[Proyecto Viaje] Pantalla caída:', error, info && info.componentStack);
  }
  render() {
    if (this.state.error) {
      return <ErrorView error={this.state.error} title={this.props.title} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
