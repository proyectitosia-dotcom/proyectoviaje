// Configuración común de los tests: nada de red real y módulos nativos sustituidos por mocks.

// AsyncStorage en memoria
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// expo-location: sin GPS real (permiso denegado por defecto)
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 40.4168, longitude: -3.7038 } })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  reverseGeocodeAsync: jest.fn(async () => []),
}));

// react-native-webview: un View vacío
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) => React.createElement(View, { testID: 'webview', ref, ...props }));
  return { __esModule: true, default: WebView, WebView };
});

// fetch: por defecto falla para garantizar que ningún test hace peticiones reales
global.fetch = jest.fn(() => Promise.reject(new Error('fetch sin mockear: los tests no pueden usar la red')));

beforeEach(() => {
  global.fetch.mockReset();
  global.fetch.mockImplementation(() => Promise.reject(new Error('fetch sin mockear: los tests no pueden usar la red')));
});
