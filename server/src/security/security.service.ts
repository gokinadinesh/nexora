import crypto from 'crypto';
import { SecurityEvent, SecuritySeverity, GAME_EVENTS } from '@nexora/shared';
import { getSocketServer } from '../sockets';

export class SecurityService {
  private readonly bufferCapacity: number = 200;
  private securityEvents: SecurityEvent[] = [];

  // Categorical counters
  private lowCount: number = 0;
  private mediumCount: number = 0;
  private highCount: number = 0;
  private criticalCount: number = 0;
  private rateLimitViolations: number = 0;
  private unauthorizedRequests: number = 0;
  private suspiciousActivityCount: number = 0;

  recordSecurityEvent(data: {
    type: string;
    severity: SecuritySeverity;
    userId?: string | null;
    username?: string | null;
    context?: Record<string, any>;
  }): SecurityEvent {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type: data.type,
      severity: data.severity,
      userId: data.userId ?? null,
      username: data.username ?? null,
      timestamp: Date.now(),
      context: data.context,
    };

    this.securityEvents.push(event);

    // Bounded buffer enforcement: retain at most bufferCapacity items
    if (this.securityEvents.length > this.bufferCapacity) {
      this.securityEvents.shift();
    }

    // Update categorical counters
    switch (data.severity) {
      case 'LOW':
        this.lowCount++;
        break;
      case 'MEDIUM':
        this.mediumCount++;
        break;
      case 'HIGH':
        this.highCount++;
        this.suspiciousActivityCount++;
        break;
      case 'CRITICAL':
        this.criticalCount++;
        this.suspiciousActivityCount++;
        break;
    }

    if (data.type === 'RATE_LIMIT_VIOLATION') {
      this.rateLimitViolations++;
    } else if (data.type === 'UNAUTHORIZED_ACCESS' || data.type === 'ROLE_TAMPERING') {
      this.unauthorizedRequests++;
    }

    // Broadcast in real-time to operators in 'monitoring' room
    try {
      const io = getSocketServer();
      io.to('monitoring').emit(GAME_EVENTS.MONITORING_SECURITY_EVENT, event);
    } catch {
      // Socket server may not be initialized yet during early boot or unit testing
    }

    return event;
  }

  getRecentSecurityEvents(limit: number = 100): SecurityEvent[] {
    const safeLimit = Math.min(Math.max(1, limit), this.bufferCapacity);
    // Return newest events first
    return [...this.securityEvents].reverse().slice(0, safeLimit);
  }

  getSummary() {
    return {
      lowCount: this.lowCount,
      mediumCount: this.mediumCount,
      highCount: this.highCount,
      criticalCount: this.criticalCount,
      rateLimitViolations: this.rateLimitViolations,
      unauthorizedRequests: this.unauthorizedRequests,
      suspiciousActivityCount: this.suspiciousActivityCount,
    };
  }

  getTotalCount(): number {
    return this.securityEvents.length;
  }

  getBufferCapacity(): number {
    return this.bufferCapacity;
  }

  clear(): void {
    this.securityEvents = [];
    this.lowCount = 0;
    this.mediumCount = 0;
    this.highCount = 0;
    this.criticalCount = 0;
    this.rateLimitViolations = 0;
    this.unauthorizedRequests = 0;
    this.suspiciousActivityCount = 0;
  }
}

export const securityService = new SecurityService();
