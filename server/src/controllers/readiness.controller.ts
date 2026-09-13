import { Request, Response } from 'express';
import { getDatabasePool, isDbConnected } from '../config/db';
import { logger } from '../utils/logger';

let isShuttingDown = false;

export function setServerShuttingDown(value: boolean): void {
  isShuttingDown = value;
}

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * GET /api/ready
 * Readiness probe for container orchestrators (Kubernetes / Docker Compose healthchecks / Load balancers).
 * Verifies that the server is accepting traffic, not shutting down, and can communicate with PostgreSQL.
 */
export async function getReadiness(req: Request, res: Response): Promise<void> {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'not_ready',
      reason: 'Server is shutting down',
      timestamp: Date.now(),
    });
    return;
  }

  try {
    const pool = getDatabasePool();
    // Lightweight database ping
    await pool.query('SELECT 1 as ping');

    const mem = process.memoryUsage();
    res.status(200).json({
      status: 'ready',
      timestamp: Date.now(),
      metrics: {
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
        },
        cpu: process.cpuUsage(),
      },
      services: {
        server: 'accepting_traffic',
        database: 'connected',
      },
    });
  } catch (err: any) {
    logger.warn('Readiness probe failed database check:', err.message);
    res.status(503).json({
      status: 'not_ready',
      reason: 'Database connectivity failure',
      error: err.message,
      timestamp: Date.now(),
      services: {
        server: 'accepting_traffic',
        database: 'disconnected',
      },
    });
  }
}
