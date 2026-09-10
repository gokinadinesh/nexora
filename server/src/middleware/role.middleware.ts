import { Request, Response, NextFunction } from 'express';
import { securityService } from '../security/security.service';
import { anomalyService } from '../security/anomaly.service';

export function requireOperator(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'OPERATOR') {
    // Record security telemetry on forbidden operator access attempt
    securityService.recordSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      severity: 'MEDIUM',
      userId: req.user.id,
      username: req.user.username,
      context: {
        path: req.originalUrl,
        method: req.method,
        attemptedRole: 'OPERATOR',
        actualRole: req.user.role,
      },
    });

    anomalyService.recordAuthFailure(req.user.id, `Forbidden access to ${req.originalUrl}`, req.user.username);

    res.status(403).json({
      status: 'error',
      message: 'Forbidden: Operator authorization required for this resource',
    });
    return;
  }

  next();
}
