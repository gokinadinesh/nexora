import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../monitoring/metrics.service';
import { eventsService } from '../monitoring/events.service';
import { healthService } from '../monitoring/health.service';
import { securityService } from '../security/security.service';
import { anomalyService } from '../security/anomaly.service';
import { authService } from '../services/auth.service';
import { config } from '../config/env';

export class MonitoringController {
  /**
   * GET /api/monitoring/metrics
   * Operator-protected endpoint returning full platform and performance telemetry.
   */
  async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await healthService.getHealthStatus();
      const metrics = metricsService.getMetrics(health.services);
      res.status(200).json(metrics);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/monitoring/events
   * Operator-protected endpoint returning recent bounded operational events.
   */
  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
      const events = eventsService.getRecentEvents(limit);
      res.status(200).json({
        events,
        total: eventsService.getTotalCount(),
        bufferCapacity: eventsService.getBufferCapacity(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/monitoring/security
   * Operator-protected endpoint returning security events, severities, and anomaly reports.
   */
  async getSecurityEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
      const events = securityService.getRecentSecurityEvents(limit);
      const summary = securityService.getSummary();
      const anomalyReports = anomalyService.getAllReports();

      res.status(200).json({
        events,
        total: securityService.getTotalCount(),
        bufferCapacity: securityService.getBufferCapacity(),
        anomalyReports,
        summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/monitoring/health
   * Detailed health check endpoint.
   */
  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await healthService.getHealthStatus();
      res.status(200).json(health);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/monitoring/promote
   * Controlled operator promotion endpoint (for development and authorized operations).
   * Guarded by server-side operator secret and disabled in production unless explicit secret configured.
   */
  async promoteOperator(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // In production mode, disable promotion unless explicitly enabled with a non-default secret
      if (config.isProduction) {
        if (!process.env.OPERATOR_SECRET || process.env.OPERATOR_SECRET === 'nexora-secret-operator-key-stage7') {
          res.status(403).json({
            status: 'error',
            message: 'Forbidden: Operator promotion is disabled in production without explicit non-default OPERATOR_SECRET',
          });
          return;
        }
      }

      const secretHeader = req.headers['x-operator-secret'];
      const validSecret = config.operatorSecret;

      if (!secretHeader || secretHeader !== validSecret) {
        securityService.recordSecurityEvent({
          type: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          context: {
            endpoint: '/api/monitoring/promote',
            providedHeader: !!secretHeader,
            ip: req.ip,
          },
        });

        res.status(403).json({
          status: 'error',
          message: 'Forbidden: Invalid operator authorization secret',
        });
        return;
      }

      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({
          status: 'error',
          message: 'userId is required',
        });
        return;
      }

      const updated = await authService.promoteToOperator(userId);
      res.status(200).json({
        status: 'success',
        message: `User ${updated.username} promoted to OPERATOR`,
        user: {
          id: updated.id,
          username: updated.username,
          role: updated.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const monitoringController = new MonitoringController();
