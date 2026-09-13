import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore, DocumentSnapshot, Transaction, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

let app: App;

if (getApps().length === 0) {
  app = initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'nexora-grid-9024',
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
