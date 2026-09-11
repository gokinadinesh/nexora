import { Request, Response, NextFunction } from 'express';
import { matchService } from '../services/match.service';

export class MatchController {
  async getMatchById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchId = req.params.id;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      if (!matchId) {
        res.status(400).json({ status: 'error', message: 'Match ID parameter is required' });
        return;
      }

      const matchDetails = await matchService.getMatchDetails(matchId, userId);
      res.status(200).json(matchDetails);
    } catch (error: any) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      const history = await matchService.getMatchHistory(userId, page, limit);
      res.status(200).json(history);
    } catch (error: any) {
      next(error);
    }
  }

  async getMatchResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchId = req.params.id;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      if (!matchId) {
        res.status(400).json({ status: 'error', message: 'Match ID parameter is required' });
        return;
      }

      const result = await matchService.getMatchResult(matchId, userId);
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  async getMatchReplay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchId = req.params.id;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      if (!matchId) {
        res.status(400).json({ status: 'error', message: 'Match ID parameter is required' });
        return;
      }

      const replay = await matchService.getMatchReplay(matchId, userId);
      res.status(200).json(replay);
    } catch (error: any) {
      next(error);
    }
  }
}

export const matchController = new MatchController();
