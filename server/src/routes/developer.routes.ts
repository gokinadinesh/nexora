import { Router } from 'express';
import { developerController } from '../controllers/developer.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireApiKey } from '../middleware/apiKeyAuth';

const router = Router();

// Endpoints for developers to manage their API keys (called from frontend)
// These require standard JWT auth
router.post('/keys', requireAuth, developerController.generateApiKey);
router.get('/keys', requireAuth, developerController.listApiKeys);
router.delete('/keys/:id', requireAuth, developerController.revokeApiKey);

// Developer API Endpoints (called by 3rd party apps using API Key)
const apiRouter = Router();

apiRouter.use(requireApiKey);
apiRouter.get('/leaderboard', developerController.getGlobalLeaderboard);
apiRouter.get('/players/:username/stats', developerController.getPlayerStats);

// Mount the developer API Router
router.use('/v1', apiRouter);

export default router;
