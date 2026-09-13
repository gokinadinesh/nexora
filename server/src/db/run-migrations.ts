import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  logger.info('Firestore is schemaless — SQL migrations skipped.');
}
