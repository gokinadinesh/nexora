import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { toPlayerProfile } from '../models/user.model';
import { presenceService } from '../services/presence.service';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password } = req.body;
      const result = await authService.register({ username, email, password });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      res.status(200).json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role || 'PLAYER',
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const userRow = await userRepository.findById(req.user.id);
      if (!userRow) {
        res.status(404).json({ status: 'error', message: 'User not found' });
        return;
      }

      const status = presenceService.getStatus(userRow.id);
      const profile = toPlayerProfile(userRow, status);

      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const { displayName, avatar, rating, wins, losses, matchesPlayed, id, username, email, role } = req.body;

      // Guard: strictly forbid client role tampering
      if (role !== undefined) {
        const { securityService } = await import('../security/security.service');
        const { anomalyService } = await import('../security/anomaly.service');
        securityService.recordSecurityEvent({
          type: 'ROLE_TAMPERING',
          severity: 'HIGH',
          userId: req.user.id,
          username: req.user.username,
          context: { attemptedRole: role },
        });
        anomalyService.recordAuthFailure(req.user.id, 'Role tampering attempted in profile update', req.user.username);

        res.status(400).json({
          status: 'error',
          message: 'Cannot directly modify user role or permissions',
        });
        return;
      }

      // Guard: strictly forbid direct modification of competitive statistics and identity
      if (
        rating !== undefined ||
        wins !== undefined ||
        losses !== undefined ||
        matchesPlayed !== undefined ||
        id !== undefined ||
        username !== undefined ||
        email !== undefined
      ) {
        res.status(400).json({
          status: 'error',
          message: 'Cannot directly modify competitive statistics, identifiers, or credentials',
        });
        return;
      }

      if (displayName !== undefined) {
        if (typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 30) {
          res.status(400).json({
            status: 'error',
            message: 'Display name must be between 2 and 30 characters',
          });
          return;
        }
      }

      if (avatar !== undefined) {
        if (typeof avatar !== 'string' || avatar.trim().length < 2 || avatar.trim().length > 50) {
          res.status(400).json({
            status: 'error',
            message: 'Avatar must be a valid preset identifier',
          });
          return;
        }
      }

      const updatedRow = await userRepository.updateProfile(req.user.id, {
        displayName: displayName !== undefined ? displayName.trim() : undefined,
        avatar: avatar !== undefined ? avatar.trim() : undefined,
      });

      const status = presenceService.getStatus(updatedRow.id);
      const profile = toPlayerProfile(updatedRow, status);

      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
