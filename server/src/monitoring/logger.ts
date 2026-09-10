export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY' | 'DEBUG';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /hash/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /credit_?card/i,
  /api_?key/i,
  /jwt/i,
];

/**
 * Recursively deep-clones and redacts sensitive keys from log payloads.
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 8 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Redact JWT-like bearer tokens: "Bearer eyJhbGci..."
    return data.replace(/Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/gi, 'Bearer [REDACTED_JWT]');
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === 'object') {
    // If it's an Error instance
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : data.stack,
      };
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return data;
}

export class StructuredLogger {
  private formatPrefix(level: LogLevel, context?: string): string {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` [${context}]` : '';
    return `[${level}] [${timestamp}]${ctx}`;
  }

  info(message: string, contextOrMeta?: any, ...extra: any[]): void {
    const { context, meta, rest } = this.extractContextAndMeta(contextOrMeta, extra);
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    const sanitizedRest = rest.map((item) => sanitizeLogData(item));

    if (sanitizedMeta) {
      console.log(`${this.formatPrefix('INFO', context)} ${message}`, sanitizedMeta, ...sanitizedRest);
    } else {
      console.log(`${this.formatPrefix('INFO', context)} ${message}`, ...sanitizedRest);
    }
  }

  warn(message: string, contextOrMeta?: any, ...extra: any[]): void {
    const { context, meta, rest } = this.extractContextAndMeta(contextOrMeta, extra);
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    const sanitizedRest = rest.map((item) => sanitizeLogData(item));

    if (sanitizedMeta) {
      console.warn(`${this.formatPrefix('WARN', context)} ${message}`, sanitizedMeta, ...sanitizedRest);
    } else {
      console.warn(`${this.formatPrefix('WARN', context)} ${message}`, ...sanitizedRest);
    }
  }

  error(message: string, contextOrMeta?: any, ...extra: any[]): void {
    const { context, meta, rest } = this.extractContextAndMeta(contextOrMeta, extra);
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    const sanitizedRest = rest.map((item) => sanitizeLogData(item));

    if (sanitizedMeta) {
      console.error(`${this.formatPrefix('ERROR', context)} ${message}`, sanitizedMeta, ...sanitizedRest);
    } else {
      console.error(`${this.formatPrefix('ERROR', context)} ${message}`, ...sanitizedRest);
    }
  }

  security(message: string, contextOrMeta?: any, ...extra: any[]): void {
    const { context, meta, rest } = this.extractContextAndMeta(contextOrMeta, extra);
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    const sanitizedRest = rest.map((item) => sanitizeLogData(item));

    if (sanitizedMeta) {
      console.warn(`${this.formatPrefix('SECURITY', context)} ${message}`, sanitizedMeta, ...sanitizedRest);
    } else {
      console.warn(`${this.formatPrefix('SECURITY', context)} ${message}`, ...sanitizedRest);
    }
  }

  debug(message: string, contextOrMeta?: any, ...extra: any[]): void {
    if (process.env.NODE_ENV === 'production' && process.env.DEBUG !== 'true') {
      return;
    }
    const { context, meta, rest } = this.extractContextAndMeta(contextOrMeta, extra);
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    const sanitizedRest = rest.map((item) => sanitizeLogData(item));

    if (sanitizedMeta) {
      console.debug(`${this.formatPrefix('DEBUG', context)} ${message}`, sanitizedMeta, ...sanitizedRest);
    } else {
      console.debug(`${this.formatPrefix('DEBUG', context)} ${message}`, ...sanitizedRest);
    }
  }

  private extractContextAndMeta(
    contextOrMeta?: any,
    extra: any[] = []
  ): { context?: string; meta?: any; rest: unknown[] } {
    if (typeof contextOrMeta === 'string') {
      const firstExtra = extra[0];
      const remainingExtra = extra.slice(1);
      return {
        context: contextOrMeta,
        meta: typeof firstExtra === 'object' && firstExtra !== null ? firstExtra : undefined,
        rest: typeof firstExtra === 'object' && firstExtra !== null ? remainingExtra : extra,
      };
    }

    if (typeof contextOrMeta === 'object' && contextOrMeta !== null) {
      return {
        context: undefined,
        meta: contextOrMeta,
        rest: extra,
      };
    }

    return {
      context: undefined,
      meta: undefined,
      rest: extra,
    };
  }
}

export const logger = new StructuredLogger();
