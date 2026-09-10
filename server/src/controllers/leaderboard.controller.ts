import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/user.repository';

export class LeaderboardController {
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const data = await userRepository.findLeaderboard(page, limit);
      res.status(200).json(data);
    } catch (error: any) {
      next(error);
    }
  }

  async getMyRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const rankData = await userRepository.findUserRank(userId);
      if (!rankData) {
        res.status(404).json({ status: 'error', message: 'User rank not found' });
        return;
      }

      res.status(200).json(rankData);
    } catch (error: any) {
      next(error);
    }
  }
}

export const leaderboardController = new LeaderboardController();
