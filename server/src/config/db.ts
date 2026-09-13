import { firestore } from './firebase';
import { logger } from '../utils/logger';

let isConnected = false;

/**
 * Validates Firestore database connectivity.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // Ping Firestore
    await firestore.collection('_health').doc('ping').get();
    isConnected = true;
    logger.info('Firestore database connection verified successfully');
    return true;
  } catch (error) {
    logger.error('Failed to verify Firestore connection:', error);
    // On Cloud Run or local dev without ADC yet, we log warning
    isConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

export function isUsingMemoryDb(): boolean {
  return false;
}

/**
 * No-op for Firestore (Admin SDK manages connection pooling automatically).
 */
export async function closeDatabasePool(): Promise<void> {
  isConnected = false;
  logger.info('Firestore connection released');
}

/**
 * Legacy stub in case any third-party code references getDatabasePool.
 */
export function getDatabasePool(): any {
  logger.warn('getDatabasePool() called but PostgreSQL is replaced by Cloud Firestore');
  return {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
  };
}
