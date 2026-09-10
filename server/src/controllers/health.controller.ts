import { Request, Response } from 'express';
import { healthService } from '../monitoring/health.service';

export async function getHealth(req: Request, res: Response): Promise<void> {
  try {
    const healthResult = await healthService.getHealthStatus();
    res.status(200).json(healthResult);
  } catch {
    res.status(200).json({
      status: 'degraded',
      service: 'nexora-server',
      services: {
        server: 'healthy',
        database: 'degraded',
        websocket: 'degraded',
        matchmaking: 'degraded',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
