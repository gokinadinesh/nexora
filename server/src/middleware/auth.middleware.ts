import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '@nexora/shared';
import { authService } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      status: 'error',
      message: 'Authorization header is required',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      status: 'error',
      message: 'Format must be: Bearer <token>',
    });
    return;
  }

  const token = parts[1];

  try {
    const user = authService.verifyToken(token);
    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
    });
  }
}
