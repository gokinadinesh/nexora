import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore, DocumentSnapshot, Transaction, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

let app: App;

if (getApps().length === 0) {
  let credential;
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (rawServiceAccount) {
    try {
      const serviceAccount = JSON.parse(rawServiceAccount);
      credential = cert(serviceAccount);
      logger.info('Firebase Admin SDK: loaded credentials from service account environment variable');
    } catch (err: any) {
      logger.warn('Firebase Admin SDK: failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
    }
  }

  app = initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'nexora-grid-9024',
    credential,
  });
  logger.info('Firebase Admin SDK initialized');
} else {
  app = getApps()[0];
}

export const firebaseAuth: Auth = getAuth(app);
export const firestore: Firestore = getFirestore(app);

// Firestore settings for better performance
firestore.settings({
  ignoreUndefinedProperties: true,
});

export type { DecodedIdToken, DocumentSnapshot, Transaction, QueryDocumentSnapshot };
export { app };
