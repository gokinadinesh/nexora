import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  port: number;
  firebaseProjectId: string;
  databaseUrl?: string;
  jwtSecret?: string;
  clientUrl: string;
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  corsOrigins: string[];
  operatorSecret: string;
  operatorUsernames: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  bodyLimit: string;
  googleClientId: string;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const defaultCorsOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const parsedCorsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : defaultCorsOrigins;

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  firebaseProjectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'nexora-grid-9024',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'firebase_managed_auth',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv,
  isProduction,
  isTest,
  corsOrigins: Array.from(new Set(parsedCorsOrigins)),
  operatorSecret: process.env.OPERATOR_SECRET || 'nexora-secret-operator-key-stage7',
  operatorUsernames: process.env.OPERATOR_USERNAMES
    ? process.env.OPERATOR_USERNAMES.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : (isProduction ? [] : ['operator', 'nexus_operator', 'admin']),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
  bodyLimit: process.env.BODY_LIMIT || '100kb',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
};

/**
 * Validates critical environment settings.
 */
export function validateConfig(cfg: AppConfig = config): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (cfg.isProduction) {
    if (cfg.operatorSecret === 'nexora-secret-operator-key-stage7') {
      errors.push('WARNING: Default development OPERATOR_SECRET is in use; operator promotion will be disabled in production.');
    }
  }

  return {
    valid: errors.filter((e) => e.startsWith('CRITICAL')).length === 0,
    errors,
  };
}
