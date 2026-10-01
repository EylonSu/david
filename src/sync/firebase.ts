import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
} from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(config).every((v) => !!v);

interface Services {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

let services: Services | undefined;

/** Lazily initialized Firebase services; undefined when the env config is missing. */
export function firebase(): Services | undefined {
  if (!isFirebaseConfigured) return undefined;
  if (!services) {
    const app = initializeApp(config);
    services = {
      app,
      auth: getAuth(app),
      firestore: initializeFirestore(app, { ignoreUndefinedProperties: true }),
      storage: getStorage(app),
    };
    getRedirectResult(services.auth).catch((e) => console.warn('redirect sign-in failed', e));
  }
  return services;
}

export async function signIn(): Promise<void> {
  const fb = firebase();
  if (!fb) throw new Error('הסנכרון אינו מוגדר');
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(fb.auth, provider);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(fb.auth, provider);
      return;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    throw e;
  }
}

export async function signOut(): Promise<void> {
  const fb = firebase();
  if (fb) await fbSignOut(fb.auth);
}
