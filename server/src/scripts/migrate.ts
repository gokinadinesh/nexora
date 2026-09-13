import { logger } from '../utils/logger';

async function main() {
  logger.info('Firestore is schemaless — migrations not required.');
}

main().catch(console.error);
