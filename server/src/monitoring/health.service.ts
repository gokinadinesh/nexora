import { SystemHealthStatus } from '@nexora/shared';
import { firestore } from '../config/firebase';
import { matchmakingService } from '../services/matchmaking.service';
import { getSocketServer } from '../sockets';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  service: string;
  services: SystemHealthStatus;
  timestamp: string;
}

export class HealthService {
  private lastDbCheckTime: number = 0;
  private lastDbStatus: 'healthy' | 'degraded' = 'healthy';
  private readonly dbCacheTtlMs: number = 2000; // 2 second cache for DB ping

  async checkDatabase(): Promise<'healthy' | 'degraded'> {
    const now = Date.now();
    if (now - this.lastDbCheckTime < this.dbCacheTtlMs) {
      return this.lastDbStatus;
    }

    try {
      await firestore.collection('_health').doc('ping').get();
      this.lastDbStatus = 'healthy';
    } catch {
      this.lastDbStatus = 'degraded';
    }

    this.lastDbCheckTime = now;
    return this.lastDbStatus;
  }

  checkWebsocket(): 'healthy' | 'degraded' {
    try {
      const io = getSocketServer();
      return io ? 'healthy' : 'degraded';
    } catch {
      return 'degraded';
    }
  }

  async checkMatchmaking(): Promise<'healthy' | 'degraded'> {
    try {
      const size = await matchmakingService.getQueueSize();
      return typeof size === 'number' ? 'healthy' : 'degraded';
    } catch {
      return 'degraded';
    }
  }

  async getHealthStatus(): Promise<HealthCheckResult> {
    const dbStatus = await this.checkDatabase();
    const wsStatus = this.checkWebsocket();
    const mmStatus = await this.checkMatchmaking();

    const services: SystemHealthStatus = {
      server: 'healthy',
      database: dbStatus,
      websocket: wsStatus,
      matchmaking: mmStatus,
    };

    const isAllHealthy = Object.values(services).every((s) => s === 'healthy');

    return {
      status: isAllHealthy ? 'ok' : 'degraded',
      service: 'nexora-server',
      services,
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
