import { Request, Response, NextFunction } from 'express';
import { matchmakingService } from '../services/matchmaking.service';
import { presenceService } from '../services/presence.service';

export class MatchmakingController {
  async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      // Read socketId from request body or fallback to active socket from presence service
      let socketId = req.body?.socketId;
      if (!socketId) {
        socketId = presenceService.getPrimarySocket(userId);
      }

      if (!socketId) {
        res.status(400).json({
          status: 'error',
          code: 'PLAYER_OFFLINE',
          message: 'An active socket connection is required to enter matchmaking',
        });
        return;
      }

      const result = await matchmakingService.joinQueue(userId, socketId);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  async leave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const result = matchmakingService.leaveQueue(userId);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const status = matchmakingService.getQueueStatus(userId);
      res.status(200).json(status);
    } catch (error: any) {
      next(error);
    }
  }
}

export const matchmakingController = new MatchmakingController();
