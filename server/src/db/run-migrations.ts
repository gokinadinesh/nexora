import fs from 'fs';
import path from 'path';
import { getDatabasePool, isUsingMemoryDb } from '../config/db';
import { logger } from '../utils/logger';

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

export async function runMigrations() {
  const pool = getDatabasePool();
  // If memory DB is used, its setup handles reading migrations.
  if (isUsingMemoryDb()) {
    logger.info('Skipping migration runner because in-memory database is active.');
    return;
  }

  // Ensure it's a real pg pool
  if (!('connect' in pool)) {
    return;
  }

  const client = await pool.connect();

  try {
    // 1. Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Read migration files
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sorting ensures sequential application

    // 3. Apply missing migrations
    for (const file of files) {
      const { rows } = await client.query('SELECT name FROM migrations WHERE name = $1', [file]);
      if (rows.length === 0) {
        logger.info(`Applying migration: ${file}...`);
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        // Start transaction for each migration
        await client.query('BEGIN');
        try {
          // split by statement or run as a single script
          // For Postgres, `client.query` can execute multiple statements separated by semicolon.
          await client.query(sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          logger.info(`Successfully applied migration: ${file}`);
        } catch (error: any) {
          await client.query('ROLLBACK');
          logger.error(`Failed to apply migration: ${file}. Error: ${error.message}`);
          throw error;
        }
      }
    }
    
    logger.info('Database migrations are up to date.');
  } catch (error: any) {
    logger.error(`Migration error: ${error.message}`);
    throw error;
  } finally {
    if ('release' in client) {
      (client as any).release();
    }
  }
}
