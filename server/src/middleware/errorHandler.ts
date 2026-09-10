import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  // In production, mask internal server error messages to prevent leakage of SQL/stack/path info
  const clientMessage = isProd && statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error');

  logger.error(
    `[${req.method}] ${req.originalUrl} (${statusCode}): ${err.message}`,
    {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      statusCode,
      code: err.code,
      details: err.details,
      stack: isProd ? undefined : err.stack,
    }
  );

  res.status(statusCode).json({
    status: 'error',
    ...(err.code && { code: err.code }),
    message: clientMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
