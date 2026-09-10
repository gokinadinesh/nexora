import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
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
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nexora',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
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

const INSECURE_JWT_SECRETS = new Set([
  'dev_jwt_secret_change_me',
  'development_secret_change_in_production',
  'secret',
  'password',
  '123456',
]);

/**
 * Validates critical environment settings.
 * In production mode, rejects insecure defaults and missing requirements.
 */
export function validateConfig(cfg: AppConfig = config): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (cfg.isProduction) {
    if (!cfg.jwtSecret || INSECURE_JWT_SECRETS.has(cfg.jwtSecret) || cfg.jwtSecret.length < 16) {
      errors.push('CRITICAL: JWT_SECRET must be set to a secure string with at least 16 characters in production.');
    }

    if (!process.env.DATABASE_URL) {
      errors.push('CRITICAL: DATABASE_URL must be explicitly configured in production.');
    }

    if (cfg.operatorSecret === 'nexora-secret-operator-key-stage7') {
      errors.push('WARNING: Default development OPERATOR_SECRET is in use; operator promotion will be disabled in production.');
    }
  }

  return {
    valid: errors.filter((e) => e.startsWith('CRITICAL')).length === 0,
    errors,
  };
}
