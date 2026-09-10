import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config/env';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders, createRateLimiter } from './middleware/security.middleware';
import apiRouter from './routes';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(securityHeaders);

  // 2. CORS configuration with explicit origin validation
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server tests)
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin) || !config.isProduction) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );

  // 3. Body limit protection (default 100kb)
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

  // 4. Request logger
  app.use(requestLogger);

  // 5. Route-specific Rate Limiters for sensitive endpoints
  const authLimiter = createRateLimiter({
    name: 'auth',
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
    message: 'Too many authentication attempts, please try again later.',
  });

  const matchmakingLimiter = createRateLimiter({
    name: 'matchmaking',
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests * 2,
    message: 'Too many matchmaking requests, please try again later.',
  });

  const promoteLimiter = createRateLimiter({
    name: 'promote',
    windowMs: 60000,
    maxRequests: 10,
    message: 'Too many operator promotion attempts, please try again later.',
  });

  app.use('/api/auth', authLimiter);
  app.use('/api/matchmaking', matchmakingLimiter);
  app.use('/api/monitoring/promote', promoteLimiter);

  // 6. Mount API routes under /api
  app.use('/api', apiRouter);

  // 7. Production static asset serving (SPA)
  const clientDistCandidates = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ];

  for (const clientDist of clientDistCandidates) {
    if (fs.existsSync(clientDist) && fs.statSync(clientDist).isDirectory()) {
      app.use(express.static(clientDist));
      app.get('*', (req, res, next) => {
        if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/socket.io')) {
          return next();
        }
        res.sendFile(path.join(clientDist, 'index.html'));
      });
      break;
    }
  }

  // 8. Centralized error handler
  app.use(errorHandler);

  return app;
}
