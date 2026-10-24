// Firebase client SDK initialization with safe fallback when not configured.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  signOut,
  type User as FirebaseUser,
  type Auth,
} from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export type User = FirebaseUser | null;

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const isConfigured = REQUIRED_KEYS.every((k) => {
  const value = cfg[k as keyof typeof cfg];
  return value && String(value).length > 0;
});

export const IS_FIREBASE_CONFIGURED = isConfigured;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isConfigured) {
  app = initializeApp(cfg as Record<string, string>);
  // App Check proves requests come from this site, not a script hitting the
  // Firestore API directly. Inactive until a reCAPTCHA v3 site key is provided.
  const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
  if (appCheckKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  auth = getAuth(app);
  // Initialize Firestore with settings to ignore undefined properties
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true
  });
  storage = getStorage(app);
}

export { app, auth, db, storage };

// Re-export Firebase Auth functions for direct use
export { signInWithEmailAndPassword, signOut } from 'firebase/auth';

// Auth helpers with fallback to local stub when Firebase is not configured

/**
 * Local user type for fallback authentication when Firebase is not configured
 */
type LocalUser = Pick<FirebaseUser, 'email'> & { uid?: string };

// Local stub state for non-configured environments
let localUser: LocalUser | null = null;
const localListeners = new Set<(user: LocalUser | null) => void>();

/**
 * Notify all local listeners of auth state changes
 */
function notifyLocal(): void {
  for (const cb of localListeners) cb(localUser);
}

/**
 * Logout the current user
 * Works with Firebase auth or falls back to localStorage
 */
export async function logout(): Promise<void> {
  if (auth) {
    await signOut(auth);
  } else {
    // Fallback (no Firebase)
    try {
      localStorage.removeItem('admin:email');
    } catch {
      /* ignore */
    }
    localUser = null;
    notifyLocal();
  }
}

/**
 * Subscribe to authentication state changes
 * @param callback - Function called when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthStateChanged(callback: (user: User) => void): () => void {
  if (auth) {
    return fbOnAuthStateChanged(auth, callback);
  }
  // Fallback: simulate auth state via localStorage
  const localCallback = callback as (u: LocalUser | null) => void;
  localListeners.add(localCallback);
  
  if (!localUser) {
    try {
      const email = localStorage.getItem('admin:email');
      if (email) localUser = { email };
    } catch {
      /* ignore */
    }
  }
  callback(localUser as User);
  
  return () => {
    localListeners.delete(localCallback);
  };
}
