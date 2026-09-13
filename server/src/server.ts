import http from 'http';
import { createApp } from './app';
import { config, validateConfig } from './config/env';
import { initSocketServer, closeSocketServer } from './sockets';
import { checkDatabaseConnection, closeDatabasePool } from './config/db';
import { runMigrations } from './db/run-migrations';
import { setServerShuttingDown } from './controllers/readiness.controller';
import { matchmakingService } from './services/matchmaking.service';
import { logger } from './utils/logger';

async function bootstrap() {
  // 1. Validate environment configuration
  const validation = validateConfig();
  for (const err of validation.errors) {
    if (err.startsWith('CRITICAL')) {
      logger.error(`Configuration Error: ${err}`);
    } else {
      logger.warn(`Configuration Notice: ${err}`);
    }
  }

  if (!validation.valid) {
    logger.error('Startup aborted due to critical configuration errors.');
    process.exit(1);
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  // 2. Initialize Socket.IO attached to HTTP server
  initSocketServer(httpServer);

  // 3. Database connection readiness check
  try {
    await checkDatabaseConnection();
    await runMigrations();
  } catch (err: any) {
    logger.warn('Initial database check encountered an error:', err.message);
  }

  // 4. Start HTTP listener
  httpServer.listen(config.port, () => {
    logger.info(`NEXORA Server running on port ${config.port} [NODE_ENV=${config.nodeEnv}]`);
    logger.info(`Liveness probe:  http://localhost:${config.port}/api/health`);
    logger.info(`Readiness probe: http://localhost:${config.port}/api/ready`);
  });

  // 5. Graceful shutdown handler
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Commencing graceful shutdown sequence...`);

    // Signal readiness probe to reject incoming traffic from load balancers
    setServerShuttingDown(true);

    // Timeout safety fallback: Force exit after 10 seconds if hanging
    const forceTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);
    if (forceTimeout.unref) forceTimeout.unref();

    try {
      // 1. Drain matchmaking queue
      matchmakingService.clearQueue();

      // 2. Close Socket.IO server & disconnect sockets cleanly
      await closeSocketServer();

      // 3. Stop accepting new HTTP connections
      await new Promise<void>((resolve) => {
        httpServer.close((err) => {
          if (err) logger.warn('HTTP server close notice:', err.message);
          logger.info('HTTP server stopped accepting new connections.');
          resolve();
        });
      });

      // 4. Drain PostgreSQL database connection pool
      await closeDatabasePool();

      logger.info('NEXORA Server shut down cleanly.');
      process.exit(0);
    } catch (err: any) {
      logger.error('Error during shutdown sequence:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
