// 1. Crea un proyecto gratuito en https://console.firebase.google.com
// 2. Añade una app "Web" y copia aquí su configuración.
// 3. Activa Firestore Database.
// Mientras apiKey sea "TU_API_KEY", la app funciona en modo local (sin compartir).
export const firebaseConfig = {
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  storageBucket: 'TU_PROYECTO.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'TU_API_KEY';
