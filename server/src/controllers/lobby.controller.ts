import { Request, Response, NextFunction } from 'express';
import { lobbyService } from '../services/lobby.service';

export class LobbyController {
  async getLobby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const lobbyData = await lobbyService.getLobbyData();
      res.status(200).json(lobbyData);
    } catch (error) {
      next(error);
    }
  }
}

export const lobbyController = new LobbyController();
