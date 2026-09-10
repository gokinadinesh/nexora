import { AnomalyLevel, AnomalyReport } from '@nexora/shared';
import { securityService } from './security.service';

interface UserActivityWindow {
  userId: string;
  username?: string;
  actionTimestamps: number[];
  invalidActions: { timestamp: number; code: string; reason: string }[];
  impossibleActions: { timestamp: number; code: string; reason: string }[];
  authFailures: { timestamp: number; reason: string }[];
  lastScore: number;
}

export class AnomalyService {
  private readonly windowMs: number = 60000; // 60-second rolling sliding window
  private userActivities = new Map<string, UserActivityWindow>();

  private getOrCreateActivity(userId: string, username?: string): UserActivityWindow {
    let activity = this.userActivities.get(userId);
    if (!activity) {
      activity = {
        userId,
        username,
        actionTimestamps: [],
        invalidActions: [],
        impossibleActions: [],
        authFailures: [],
        lastScore: 0,
      };
      this.userActivities.set(userId, activity);
    }
    if (username && !activity.username) {
      activity.username = username;
    }
    return activity;
  }

  private pruneActivity(activity: UserActivityWindow, now: number): void {
    const cutoff = now - this.windowMs;
    activity.actionTimestamps = activity.actionTimestamps.filter((t) => t >= cutoff);
    activity.invalidActions = activity.invalidActions.filter((a) => a.timestamp >= cutoff);
    activity.impossibleActions = activity.impossibleActions.filter((a) => a.timestamp >= cutoff);
    activity.authFailures = activity.authFailures.filter((a) => a.timestamp >= cutoff);
  }

  recordAction(userId: string, username?: string): AnomalyReport {
    const now = Date.now();
    const activity = this.getOrCreateActivity(userId, username);
    activity.actionTimestamps.push(now);
    return this.evaluateUser(userId, username);
  }

  recordInvalidAction(userId: string, code: string, reason: string, username?: string): AnomalyReport {
    const now = Date.now();
    const activity = this.getOrCreateActivity(userId, username);
    activity.invalidActions.push({ timestamp: now, code, reason });
    return this.evaluateUser(userId, username);
  }

  recordImpossibleAction(userId: string, code: string, reason: string, username?: string): AnomalyReport {
    const now = Date.now();
    const activity = this.getOrCreateActivity(userId, username);
    activity.impossibleActions.push({ timestamp: now, code, reason });
    return this.evaluateUser(userId, username);
  }

  recordAuthFailure(userId: string, reason: string, username?: string): AnomalyReport {
    const now = Date.now();
    const activity = this.getOrCreateActivity(userId, username);
    activity.authFailures.push({ timestamp: now, reason });
    return this.evaluateUser(userId, username);
  }

  evaluateUser(userId: string, username?: string): AnomalyReport {
    const now = Date.now();
    const activity = this.getOrCreateActivity(userId, username);
    this.pruneActivity(activity, now);

    // 1. Action Flooding Rule: Check rapid action bursts in short windows (e.g. 2 seconds)
    let floodingFactor = 0;
    const actions = activity.actionTimestamps;
    for (let i = 0; i < actions.length; i++) {
      const windowStart = actions[i];
      const burstCount = actions.filter((t) => t >= windowStart && t <= windowStart + 2000).length;
      if (burstCount >= 10) {
        floodingFactor = Math.max(floodingFactor, 50);
      } else if (burstCount >= 6) {
        floodingFactor = Math.max(floodingFactor, 30);
      } else if (burstCount >= 4) {
        floodingFactor = Math.max(floodingFactor, 15);
      }
    }

    // 2. Repeated Invalid Actions Rule
    let invalidFactor = 0;
    const invalidCount = activity.invalidActions.length;
    if (invalidCount >= 5) {
      invalidFactor = 50;
    } else if (invalidCount >= 3) {
      invalidFactor = 35;
    } else if (invalidCount >= 2) {
      invalidFactor = 15;
    }

    // 3. Impossible Action Pattern Rule (Diagonal moves, wrong turn, manipulating other's nodes)
    let impossibleFactor = 0;
    const impossibleCount = activity.impossibleActions.length;
    if (impossibleCount >= 3) {
      impossibleFactor = 50;
    } else if (impossibleCount >= 2) {
      impossibleFactor = 30;
    } else if (impossibleCount >= 1) {
      impossibleFactor = 15;
    }

    // 4. Repeated Authorization Failures Rule
    let authFactor = 0;
    const authCount = activity.authFailures.length;
    if (authCount >= 3) {
      authFactor = 45;
    } else if (authCount >= 2) {
      authFactor = 25;
    } else if (authCount >= 1) {
      authFactor = 10;
    }

    // Aggregate deterministic anomaly score strictly bounded [0, 100]
    const rawScore = floodingFactor + invalidFactor + impossibleFactor + authFactor;
    const score = Math.min(100, Math.max(0, rawScore));

    let level: AnomalyLevel = 'NORMAL';
    if (score >= 80) {
      level = 'HIGH';
    } else if (score >= 60) {
      level = 'MEDIUM';
    } else if (score >= 30) {
      level = 'LOW';
    }

    // Escalate to security event if transitioning from below 60 to 60+
    if (score >= 60 && activity.lastScore < 60) {
      securityService.recordSecurityEvent({
        type: 'ANOMALY_DETECTED',
        severity: score >= 80 ? 'CRITICAL' : 'HIGH',
        userId,
        username: activity.username,
        context: {
          score,
          level,
          factors: {
            actionFlooding: floodingFactor,
            repeatedInvalidActions: invalidFactor,
            impossibleActions: impossibleFactor,
            authFailures: authFactor,
          },
        },
      });
    }

    activity.lastScore = score;

    return {
      userId,
      username: activity.username,
      score,
      level,
      factors: {
        actionFlooding: floodingFactor,
        repeatedInvalidActions: invalidFactor,
        impossibleActions: impossibleFactor,
        authFailures: authFactor,
      },
      lastEvaluated: now,
    };
  }

  getReport(userId: string): AnomalyReport | null {
    if (!this.userActivities.has(userId)) return null;
    return this.evaluateUser(userId);
  }

  getAllReports(): AnomalyReport[] {
    const reports: AnomalyReport[] = [];
    for (const [userId, act] of this.userActivities.entries()) {
      reports.push(this.evaluateUser(userId, act.username));
    }
    // Return highest anomaly scores first
    return reports.sort((a, b) => b.score - a.score);
  }

  clear(): void {
    this.userActivities.clear();
  }
}

export const anomalyService = new AnomalyService();
