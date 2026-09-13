import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDyQ2VmT3kezsrVPK0nHWJi9Qzw4lN1HN0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nexora-grid-9024.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nexora-grid-9024',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nexora-grid-9024.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '236443205028',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:236443205028:web:7306e1daed60d261181531',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
