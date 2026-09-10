import {
  MonitoringMetricsResponse,
  PlatformMetrics,
  PerformanceMetrics,
  SystemHealthStatus,
} from '@nexora/shared';
import { presenceService } from '../services/presence.service';
import { matchSessionService } from '../services/match-session.service';
import { matchmakingService } from '../services/matchmaking.service';

export class MetricsService {
  private startTime: number = Date.now();
  private wsConnections: number = 0;

  // Platform counters
  private eventsProcessedCount: number = 0;
  private eventsRejectedCount: number = 0;
  private actionsProcessedCount: number = 0;
  private actionsRejectedCount: number = 0;
  private matchesStartedCount: number = 0;
  private matchesCompletedCount: number = 0;
  private errorCount: number = 0;
  private slowActionCount: number = 0;

  // Rolling latency samples (bounded to 100)
  private readonly maxSamples = 100;
  private actionLatencySamples: number[] = [];
  private eventProcessingSamples: number[] = [];

  // Throughput sliding window (timestamps of recent actions/events within last 10s)
  private actionTimestamps: number[] = [];
  private eventTimestamps: number[] = [];

  recordAction(latencyMs: number, success: boolean): void {
    const now = Date.now();
    if (success) {
      this.actionsProcessedCount++;
    } else {
      this.actionsRejectedCount++;
    }

    if (latencyMs > 100) {
      this.slowActionCount++;
    }

    this.actionLatencySamples.push(latencyMs);
    if (this.actionLatencySamples.length > this.maxSamples) {
      this.actionLatencySamples.shift();
    }

    this.actionTimestamps.push(now);
    this.pruneTimestamps();
  }

  recordEvent(type: string, processingMs: number = 0, success: boolean = true): void {
    const now = Date.now();
    if (success) {
      this.eventsProcessedCount++;
    } else {
      this.eventsRejectedCount++;
    }

    if (processingMs > 0) {
      this.eventProcessingSamples.push(processingMs);
      if (this.eventProcessingSamples.length > this.maxSamples) {
        this.eventProcessingSamples.shift();
      }
    }

    this.eventTimestamps.push(now);
    this.pruneTimestamps();
  }

  recordError(): void {
    this.errorCount++;
  }

  recordMatchStarted(): void {
    this.matchesStartedCount++;
  }

  recordMatchCompleted(): void {
    this.matchesCompletedCount++;
  }

  incrementWebsocket(): void {
    this.wsConnections++;
  }

  decrementWebsocket(): void {
    this.wsConnections = Math.max(0, this.wsConnections - 1);
  }

  setWebsocketCount(count: number): void {
    this.wsConnections = Math.max(0, count);
  }

  private pruneTimestamps(): void {
    const cutoff = Date.now() - 10000; // 10 second window
    while (this.actionTimestamps.length > 0 && this.actionTimestamps[0] < cutoff) {
      this.actionTimestamps.shift();
    }
    while (this.eventTimestamps.length > 0 && this.eventTimestamps[0] < cutoff) {
      this.eventTimestamps.shift();
    }
  }

  async getMetrics(healthStatus?: SystemHealthStatus): Promise<MonitoringMetricsResponse> {
    this.pruneTimestamps();
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.startTime) / 1000);

    const avgActionLatency =
      this.actionLatencySamples.length > 0
        ? Math.round(
            (this.actionLatencySamples.reduce((a, b) => a + b, 0) / this.actionLatencySamples.length) * 10
          ) / 10
        : 0;

    const avgEventProcessing =
      this.eventProcessingSamples.length > 0
        ? Math.round(
            (this.eventProcessingSamples.reduce((a, b) => a + b, 0) / this.eventProcessingSamples.length) * 10
          ) / 10
        : 0;

    const actionsPerSecond = Math.round((this.actionTimestamps.length / 10) * 10) / 10;
    const eventsPerSecond = Math.round((this.eventTimestamps.length / 10) * 10) / 10;

    const activePlayers = await presenceService.getOnlineCount();
    const activeMatches = await matchSessionService.getActiveSessionCount();
    const matchmakingQueue = await matchmakingService.getQueueSize();

    const platform: PlatformMetrics = {
      activePlayers,
      activeMatches,
      matchmakingQueue,
      websocketConnections: this.wsConnections,
      totalConnectedUsers: activePlayers,
      eventsProcessed: this.eventsProcessedCount,
      eventsRejected: this.eventsRejectedCount,
      actionsProcessed: this.actionsProcessedCount,
      actionsRejected: this.actionsRejectedCount,
      matchesStarted: this.matchesStartedCount,
      matchesCompleted: this.matchesCompletedCount,
      serverUptime: uptimeSeconds,
      timestamp: now,
      instanceLabel: 'Current Server Instance',
    };

    const performance: PerformanceMetrics = {
      averageActionLatency: avgActionLatency,
      averageEventProcessingTime: avgEventProcessing,
      recentLatencySamples: [...this.actionLatencySamples.slice(-20)],
      slowActions: this.slowActionCount,
      errorCount: this.errorCount,
      actionsPerSecond,
      eventsPerSecond,
    };

    const health: SystemHealthStatus = healthStatus || {
      server: 'healthy',
      database: 'healthy',
      websocket: 'healthy',
      matchmaking: 'healthy',
    };

    return {
      platform,
      performance,
      health,
      // Flat top-level convenience properties
      activePlayers: platform.activePlayers,
      activeMatches: platform.activeMatches,
      matchmakingQueue: platform.matchmakingQueue,
      websocketConnections: platform.websocketConnections,
      eventsProcessed: platform.eventsProcessed,
      eventsRejected: platform.eventsRejected,
      actionsProcessed: platform.actionsProcessed,
      actionsRejected: platform.actionsRejected,
      matchesStarted: platform.matchesStarted,
      matchesCompleted: platform.matchesCompleted,
      averageActionLatency: performance.averageActionLatency,
      serverUptime: platform.serverUptime,
      errorCount: performance.errorCount,
      timestamp: now,
      instanceLabel: platform.instanceLabel,
    };
  }
}

export const metricsService = new MetricsService();
