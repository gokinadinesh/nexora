import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore, DocumentSnapshot, Transaction, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

import fs from 'fs';
import path from 'path';

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

  if (!credential) {
    const candidatePaths = [
      path.resolve(process.cwd(), 'service-account.json'),
      path.resolve(process.cwd(), 'server', 'service-account.json'),
      path.resolve(__dirname, '../../service-account.json'),
      path.resolve(__dirname, '../../../server/service-account.json')
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const fileContent = JSON.parse(fs.readFileSync(p, 'utf-8'));
          credential = cert(fileContent);
          logger.info(`Firebase Admin SDK: loaded credentials from ${p}`);
          break;
        } catch (err: any) {
          logger.warn(`Failed reading service account file at ${p}:`, err.message);
        }
      }
    }
  }

  const appOptions: any = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'nexora-grid-9024',
  };
  if (credential) {
    appOptions.credential = credential;
  }

  app = initializeApp(appOptions);
  logger.info('Firebase Admin SDK initialized successfully');
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
