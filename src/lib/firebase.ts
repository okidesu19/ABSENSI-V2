import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase is properly configured
const isFirebaseConfigured = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  return apiKey && !apiKey.includes('Demo') && !apiKey.includes('demo');
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;
let initError: Error | null = null;

// Initialize Firebase lazily
const initFirebase = () => {
  if (!isFirebaseConfigured()) {
    initError = new Error('Firebase not configured');
    return false;
  }

  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    database = getDatabase(app);
    return true;
  } catch (error) {
    initError = error as Error;
    return false;
  }
};

// Try to initialize on module load
initFirebase();

export { app, auth, database, initError, isFirebaseConfigured, initFirebase };
