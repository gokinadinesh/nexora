import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth.routes';
import { requireAuth } from '../middleware/auth.middleware';
import { authController } from '../controllers/auth.controller';
import { lobbyController } from '../controllers/lobby.controller';
import { matchmakingController } from '../controllers/matchmaking.controller';
import { matchController } from '../controllers/match.controller';
import { leaderboardController } from '../controllers/leaderboard.controller';
import monitoringRouter from './monitoring.routes';

const apiRouter = Router();

// Public endpoints
apiRouter.use('/', healthRouter);
apiRouter.use('/auth', authRouter);

// Operations & Monitoring endpoints
apiRouter.use('/monitoring', monitoringRouter);

import billingRouter from './billing.routes';
import developerRouter from './developer.routes';

// Protected endpoints
apiRouter.use('/billing', billingRouter);
apiRouter.use('/developer', developerRouter);
apiRouter.get('/me', requireAuth, (req, res, next) => authController.getMe(req, res, next));
apiRouter.get('/profile', requireAuth, (req, res, next) => authController.getProfile(req, res, next));
apiRouter.patch('/profile', requireAuth, (req, res, next) => authController.updateProfile(req, res, next));
apiRouter.get('/lobby', requireAuth, (req, res, next) => lobbyController.getLobby(req, res, next));

// Leaderboard endpoints
apiRouter.get('/leaderboard/me', requireAuth, (req, res, next) => leaderboardController.getMyRank(req, res, next));
apiRouter.get('/leaderboard', requireAuth, (req, res, next) => leaderboardController.getLeaderboard(req, res, next));

// Matchmaking & Match Session endpoints
apiRouter.post('/matchmaking/join', requireAuth, (req, res, next) => matchmakingController.join(req, res, next));
apiRouter.post('/matchmaking/leave', requireAuth, (req, res, next) => matchmakingController.leave(req, res, next));
apiRouter.get('/matchmaking/status', requireAuth, (req, res, next) => matchmakingController.getStatus(req, res, next));

// Match history & results (history must be registered before :id)
apiRouter.get('/matches/history', requireAuth, (req, res, next) => matchController.getHistory(req, res, next));
apiRouter.get('/matches/:id/result', requireAuth, (req, res, next) => matchController.getMatchResult(req, res, next));
apiRouter.get('/matches/:id/replay', requireAuth, (req, res, next) => matchController.getMatchReplay(req, res, next));
apiRouter.get('/matches/:id', requireAuth, (req, res, next) => matchController.getMatchById(req, res, next));

export default apiRouter;
