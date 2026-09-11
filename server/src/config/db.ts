import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { config } from './env';
import { logger } from '../utils/logger';

export interface IDatabasePool {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }>;
  connect(): Promise<{ query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }>; release: () => void }>;
}

let pool: IDatabasePool | null = null;
let isConnected = false;
let isMemoryFallback = false;

const DEFAULT_USERS_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(50),
  avatar VARCHAR(255) DEFAULT 'default_operative',
  role VARCHAR(20) DEFAULT 'PLAYER' NOT NULL,
  is_pro BOOLEAN DEFAULT false NOT NULL,
  stripe_subscription_id VARCHAR(100),
  rating INT DEFAULT 1000 NOT NULL,
  wins INT DEFAULT 0 NOT NULL,
  losses INT DEFAULT 0 NOT NULL,
  matches_played INT DEFAULT 0 NOT NULL,
  total_score INT DEFAULT 0 NOT NULL,
  best_score INT DEFAULT 0 NOT NULL,
  current_win_streak INT DEFAULT 0 NOT NULL,
  best_win_streak INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users (rating DESC);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  winner_id UUID REFERENCES users(id),
  duration_seconds INT DEFAULT 0 NOT NULL,
  final_version INT DEFAULT 1 NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_ended_at ON matches (ended_at DESC);

CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  score INT DEFAULT 0 NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  rating_before INT DEFAULT 1000 NOT NULL,
  rating_after INT DEFAULT 1000 NOT NULL,
  rating_change INT DEFAULT 0 NOT NULL,
  CONSTRAINT uq_match_players_match_user UNIQUE (match_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players (match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user_id ON match_players (user_id);

CREATE TABLE IF NOT EXISTS game_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  state_version INT NOT NULL DEFAULT 1,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_game_states_match_id ON game_states (match_id);

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events (match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_timestamp ON match_events (timestamp DESC);
`;

function createMemoryPool(): IDatabasePool {
  const db = newDb();
  // Register pgcrypto gen_random_uuid if invoked in SQL
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => require('crypto').randomUUID(),
  });

  db.public.registerFunction({
    name: 'greatest',
    implementation: (...args: number[]) => Math.max(...args),
  });

  const { Pool: MemPool } = db.adapters.createPg();
  const memPool = new MemPool();

  // Search candidate directories for migrations
  const candidateDirs = [
    path.resolve(__dirname, '../db/migrations'),
    path.resolve(__dirname, '../migrations'),
    path.resolve(__dirname, '../../src/migrations'),
    path.resolve(process.cwd(), 'src/migrations'),
    path.resolve(process.cwd(), 'server/src/migrations'),
  ];

  let appliedMigrations = false;

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      try {
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.sql'))
          .sort();

        if (files.length > 0) {
          for (const file of files) {
            const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
            // Execute statements (split by semicolon if needed for pg-mem compatibility)
            const statements = sql
              .split(';')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            for (const statement of statements) {
              db.public.none(statement);
            }
            logger.info(`Applied in-memory migration: ${file}`);
          }
          appliedMigrations = true;
          break;
        }
      } catch (err) {
        logger.warn(`Error applying migrations from ${dir}:`, err);
      }
    }
  }

  if (!appliedMigrations) {
    const statements = DEFAULT_USERS_SCHEMA.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      db.public.none(stmt);
    }
    logger.info('Applied default full users schema to in-memory database');
  }

  return memPool as unknown as IDatabasePool;
}

export function getDatabasePool(): IDatabasePool {
  if (!pool) {
    if (process.env.USE_MEMORY_DB === 'true') {
      logger.info('USE_MEMORY_DB=true: Initializing in-memory PostgreSQL engine');
      pool = createMemoryPool();
      isConnected = true;
      isMemoryFallback = true;
      return pool;
    }

    const isLocalDb =
      config.databaseUrl.includes('localhost') ||
      config.databaseUrl.includes('127.0.0.1') ||
      config.databaseUrl.includes('@postgres:');

    const requiresSsl =
      config.databaseUrl.includes('sslmode=require') ||
      (config.isProduction && !isLocalDb);

    const pgPool = new Pool({
      connectionString: config.databaseUrl,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pgPool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', err);
    });

    pool = pgPool as unknown as IDatabasePool;
  }

  return pool;
}

/**
 * Validates database connectivity without crashing the server if DB is offline.
 * Automatically falls back to in-memory database in development/testing if PostgreSQL is unreachable.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  const currentPool = getDatabasePool();

  try {
    const client = await currentPool.connect();
    client.release();
    isConnected = true;
    logger.info('Database connection established successfully' + (isMemoryFallback ? ' (in-memory mode)' : ''));
    return true;
  } catch (error) {
    logger.warn(`PostgreSQL unavailable at ${config.databaseUrl} (${(error as Error).message})`);

    // In development or test, fall back to in-memory SQL engine so developer/tests can operate
    if (!config.isProduction) {
      logger.info('Activating in-memory PostgreSQL fallback for local development/testing');
      pool = createMemoryPool();
      isConnected = true;
      isMemoryFallback = true;
      return true;
    }

    isConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

export function isUsingMemoryDb(): boolean {
  return isMemoryFallback || process.env.USE_MEMORY_DB === 'true';
}

/**
 * Closes the database pool and releases all idle/active connections cleanly.
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    logger.info('Closing database connection pool...');
    try {
      if ('end' in pool && typeof (pool as any).end === 'function') {
        await (pool as any).end();
      }
    } catch (err: any) {
      logger.warn('Error while closing database pool:', err.message);
    } finally {
      pool = null;
      isConnected = false;
      isMemoryFallback = false;
      logger.info('Database connection pool closed successfully');
    }
  }
}

