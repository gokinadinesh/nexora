import fs from 'fs';
import path from 'path';
import { getDatabasePool } from '../config/db';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const pool = getDatabasePool();
  const migrationsDir = path.resolve(__dirname, '../migrations');

  logger.info(`Running database migrations from ${migrationsDir}...`);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    logger.info(`Applying migration: ${file}`);
    await pool.query(sql);
    logger.info(`Successfully applied migration: ${file}`);
  }

  logger.info('All migrations completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed:', err.message);
      process.exit(1);
    });
}
