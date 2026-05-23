import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Support override via Vite environment variables if defined
const metaEnv = (import.meta as any).env || {};
const config = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || firebaseConfig.appId
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(config) : getApp();

const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

// Initialize Firestore with robust local caching
// If the app runs inside a sandboxed Iframe, IndexedDB might be restricted.
// We fall back transparently to Memory Cache to prevent crashes!
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }, dbId);
  console.log('Firebase Offline Cache Enabled Successfully with database ID: ' + dbId);
} catch (error) {
  console.warn('Firebase Offline Cache failed to initialize (usually due to iframe sandbox restrictions). Falling back to memory-only storage for database ID: ' + dbId, error);
  db = initializeFirestore(app, {
    localCache: memoryLocalCache()
  }, dbId);
}

// Ensure db and auth instances are exported
export const auth = getAuth(app);
export { db };

// Dedicated helper for modern Google login as recommended by Firebase in typical iframe integrations
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// SKILL CONFIG: Mandatory connection check block to assist developer diagnostics
async function testConnection() {
  try {
    // Attempting a direct server-only lookup on connection test dummy doc
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase Connection Warning: The client is offline. Please check your credentials and internet presence.");
    } else {
      // Dummy check usually yields a "permission-denied" or "not-found", which means connection succeeded!
      console.log("Firebase connection response validated.");
    }
  }
}

// Call lazy validation
testConnection();
