import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { getReadiness } from '../controllers/readiness.controller';

const router = Router();

// Liveness probe
router.get('/health', getHealth);

// Readiness probe
router.get('/ready', getReadiness);

export default router;
