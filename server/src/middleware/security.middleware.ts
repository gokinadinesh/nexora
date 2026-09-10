import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Standard HTTP security headers to protect against common web vulnerabilities.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking by denying framing
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Strict Transport Security in production
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Remove X-Powered-By
  res.removeHeader('X-Powered-By');

  next();
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  name?: string;
}

/**
 * Lightweight, in-memory sliding window rate limiter for Express routes.
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs || config.rateLimitWindowMs || 60000;
  const maxRequests = options.maxRequests || config.rateLimitMaxRequests || 60;
  const message = options.message || 'Too many requests, please try again later.';
  const name = options.name || 'generic';

  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up expired entries every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 120000);

  // Unref cleanup interval so it doesn't prevent Node process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, allow disabling or bypassing rate limit if explicitly configured
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const key = `${name}:${ip}`;
    const now = Date.now();
    const record = store.get(key);

    if (!record || now > record.resetTime) {
      store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    record.count++;
    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      logger.warn(`Rate limit exceeded for [${key}] on ${req.method} ${req.originalUrl}`);

      // Async record security event if available
      import('../security/security.service')
        .then(({ securityService }) => {
          securityService.recordSecurityEvent({
            type: 'RATE_LIMIT_VIOLATION',
            severity: 'LOW',
            context: {
              ip,
              limiter: name,
              path: req.originalUrl,
              method: req.method,
            },
          });
        })
        .catch(() => {});

      res.status(429).json({
        status: 'error',
        code: 'RATE_LIMITED',
        message,
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    next();
  };
}
