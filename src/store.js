// Capa de datos: Firestore en tiempo real (compartido) o AsyncStorage (modo local).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

let db = null;
let fs = null;
if (isFirebaseConfigured) {
  const { initializeApp } = require('firebase/app');
  fs = require('firebase/firestore');
  db = fs.getFirestore(initializeApp(firebaseConfig));
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newTripData(name, startDate) {
  return {
    name,
    startDate, // YYYY-MM-DD
    createdAt: Date.now(),
    routes: [],
    hotels: [],
    days: Array.from({ length: 30 }, (_, i) => ({ id: uid(), number: i + 1, plan: '', routeIds: [], events: [] })),
    expenses: [],
    group: { members: [], expenses: [] },
  };
}

const genCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// ---------- Modo local ----------
const listeners = {};
const localKey = (code) => `trip:${code}`;
async function localGet(code) {
  const raw = await AsyncStorage.getItem(localKey(code));
  return raw ? JSON.parse(raw) : null;
}
async function localSet(code, data) {
  await AsyncStorage.setItem(localKey(code), JSON.stringify(data));
  (listeners[code] || []).forEach((cb) => cb(data));
}

// ---------- API pública ----------
export async function createTrip(name, startDate) {
  const code = genCode();
  const data = newTripData(name, startDate);
  if (db) await fs.setDoc(fs.doc(db, 'trips', code), data);
  else await localSet(code, data);
  return code;
}

export async function tripExists(code) {
  if (db) return (await fs.getDoc(fs.doc(db, 'trips', code))).exists();
  return !!(await localGet(code));
}

export function subscribeTrip(code, cb) {
  if (db) return fs.onSnapshot(fs.doc(db, 'trips', code), (snap) => cb(snap.exists() ? snap.data() : null));
  listeners[code] = [...(listeners[code] || []), cb];
  localGet(code).then(cb);
  return () => { listeners[code] = listeners[code].filter((l) => l !== cb); };
}

// Actualiza solo los campos indicados (p.ej. { hotels: [...] }) para minimizar conflictos.
export async function updateTrip(code, patch) {
  if (db) return fs.updateDoc(fs.doc(db, 'trips', code), patch);
  const cur = (await localGet(code)) || {};
  await localSet(code, { ...cur, ...patch });
}

// Lista de viajes guardados en este dispositivo
export async function getMyTrips() {
  return JSON.parse((await AsyncStorage.getItem('myTrips')) || '[]');
}
export async function addMyTrip(code, name) {
  const list = (await getMyTrips()).filter((t) => t.code !== code);
  await AsyncStorage.setItem('myTrips', JSON.stringify([{ code, name }, ...list]));
}
export async function removeMyTrip(code) {
  const list = (await getMyTrips()).filter((t) => t.code !== code);
  await AsyncStorage.setItem('myTrips', JSON.stringify(list));
}
export const isShared = !!db;
