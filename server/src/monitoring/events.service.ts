import crypto from 'crypto';
import { OperationalEvent, GAME_EVENTS } from '@nexora/shared';
import { getSocketServer } from '../sockets';

export class EventsService {
  private readonly bufferCapacity: number = 200;
  private eventBuffer: OperationalEvent[] = [];

  recordEvent(data: {
    type: string;
    matchId?: string | null;
    userId?: string | null;
    username?: string | null;
    duration?: number;
    success?: boolean;
    reason?: string | null;
    metadata?: Record<string, any>;
  }): OperationalEvent {
    const event: OperationalEvent = {
      id: crypto.randomUUID(),
      type: data.type,
      timestamp: Date.now(),
      matchId: data.matchId ?? null,
      userId: data.userId ?? null,
      username: data.username ?? null,
      duration: data.duration,
      success: data.success !== false,
      reason: data.reason ?? null,
      metadata: data.metadata,
    };

    this.eventBuffer.push(event);

    // Bounded buffer enforcement: retain at most bufferCapacity items
    if (this.eventBuffer.length > this.bufferCapacity) {
      this.eventBuffer.shift();
    }

    // Broadcast in real-time to operators in 'monitoring' room
    try {
      const io = getSocketServer();
      io.to('monitoring').emit(GAME_EVENTS.MONITORING_EVENT, event);
    } catch {
      // Socket server may not be initialized yet during early boot or unit testing
    }

    return event;
  }

  getRecentEvents(limit: number = 100): OperationalEvent[] {
    const safeLimit = Math.min(Math.max(1, limit), this.bufferCapacity);
    // Return newest events first
    return [...this.eventBuffer].reverse().slice(0, safeLimit);
  }

  getTotalCount(): number {
    return this.eventBuffer.length;
  }

  getBufferCapacity(): number {
    return this.bufferCapacity;
  }

  clear(): void {
    this.eventBuffer = [];
  }
}

export const eventsService = new EventsService();
