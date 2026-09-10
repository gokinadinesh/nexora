import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireOperator } from '../middleware/role.middleware';
import { monitoringController } from '../controllers/monitoring.controller';

const monitoringRouter = Router();

// Operator-protected telemetry & monitoring endpoints
monitoringRouter.get('/metrics', requireAuth, requireOperator, (req, res, next) =>
  monitoringController.getMetrics(req, res, next)
);

monitoringRouter.get('/events', requireAuth, requireOperator, (req, res, next) =>
  monitoringController.getEvents(req, res, next)
);

monitoringRouter.get('/security', requireAuth, requireOperator, (req, res, next) =>
  monitoringController.getSecurityEvents(req, res, next)
);

monitoringRouter.get('/health', requireAuth, requireOperator, (req, res, next) =>
  monitoringController.getHealth(req, res, next)
);

// Controlled developer/test helper for designating demo operators
monitoringRouter.post('/promote', (req, res, next) =>
  monitoringController.promoteOperator(req, res, next)
);

export default monitoringRouter;
