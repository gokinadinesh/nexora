import { MatchStatus, MATCH_STATUS } from '@nexora/shared';

export interface ActiveMatchSession {
  matchId: string;
  playerIds: string[];
  socketMap: Map<string, string>; // userId -> socketId
  status: MatchStatus;
  createdAt: number;
}

export interface IMatchSessionStore {
  createSession(matchId: string, players: { userId: string; socketId?: string }[]): Promise<ActiveMatchSession>;
  getSession(matchId: string): Promise<ActiveMatchSession | null>;
  getSessionByUserId(userId: string): Promise<ActiveMatchSession | null>;
  updatePlayerSocket(userId: string, socketId: string): Promise<void>;
  handlePlayerDisconnect(socketId: string): Promise<{ matchId?: string; userId?: string }>;
  isUserInActiveMatch(userId: string): Promise<boolean>;
  endSession(matchId: string): Promise<void>;
  getActiveSessionCount(): Promise<number>;
}

export class InMemoryMatchSessionStore implements IMatchSessionStore {
  private sessions = new Map<string, ActiveMatchSession>();
  private userToMatch = new Map<string, string>();
  private socketToMatch = new Map<string, string>();

  async createSession(matchId: string, players: { userId: string; socketId?: string }[]): Promise<ActiveMatchSession> {
    const socketMap = new Map<string, string>();
    const playerIds: string[] = [];

    for (const p of players) {
      playerIds.push(p.userId);
      this.userToMatch.set(p.userId, matchId);
      if (p.socketId) {
        socketMap.set(p.userId, p.socketId);
        this.socketToMatch.set(p.socketId, matchId);
      }
    }

    const session: ActiveMatchSession = {
      matchId,
      playerIds,
      socketMap,
      status: MATCH_STATUS.ACTIVE,
      createdAt: Date.now(),
    };

    this.sessions.set(matchId, session);
    return session;
  }

  async getSession(matchId: string): Promise<ActiveMatchSession | null> {
    return this.sessions.get(matchId) || null;
  }

  async getSessionByUserId(userId: string): Promise<ActiveMatchSession | null> {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return null;
    return this.sessions.get(matchId) || null;
  }

  async updatePlayerSocket(userId: string, socketId: string): Promise<void> {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;

    const session = this.sessions.get(matchId);
    if (session) {
      const oldSocket = session.socketMap.get(userId);
      if (oldSocket) {
        this.socketToMatch.delete(oldSocket);
      }

      session.socketMap.set(userId, socketId);
      this.socketToMatch.set(socketId, matchId);
    }
  }

  async handlePlayerDisconnect(socketId: string): Promise<{ matchId?: string; userId?: string }> {
    const matchId = this.socketToMatch.get(socketId);
    if (!matchId) return {};

    this.socketToMatch.delete(socketId);
    const session = this.sessions.get(matchId);
    if (!session) return { matchId };

    let disconnectedUserId: string | undefined;
    for (const [userId, sId] of session.socketMap.entries()) {
      if (sId === socketId) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      session.socketMap.delete(disconnectedUserId);
    }

    return { matchId, userId: disconnectedUserId };
  }

  async isUserInActiveMatch(userId: string): Promise<boolean> {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return false;
    const session = this.sessions.get(matchId);
    return !!session && session.status === MATCH_STATUS.ACTIVE;
  }

  async endSession(matchId: string): Promise<void> {
    const session = this.sessions.get(matchId);
    if (!session) return;

    for (const userId of session.playerIds) {
      this.userToMatch.delete(userId);
    }
    for (const socketId of session.socketMap.values()) {
      this.socketToMatch.delete(socketId);
    }

    this.sessions.delete(matchId);
  }

  async getActiveSessionCount(): Promise<number> {
    return this.sessions.size;
  }
}

import { redisClient } from '../db/redis';

export class RedisMatchSessionStore implements IMatchSessionStore {
  // session:match:{matchId} -> JSON of ActiveMatchSession (with Record instead of Map)
  // session:user:{userId} -> matchId
  // session:socket:{socketId} -> matchId

  private deserialize(data: string): ActiveMatchSession {
    const parsed = JSON.parse(data);
    parsed.socketMap = new Map(Object.entries(parsed.socketMap || {}));
    return parsed as ActiveMatchSession;
  }

  private serialize(session: ActiveMatchSession): string {
    const toSave = {
      ...session,
      socketMap: Object.fromEntries(session.socketMap),
    };
    return JSON.stringify(toSave);
  }

  async createSession(matchId: string, players: { userId: string; socketId?: string }[]): Promise<ActiveMatchSession> {
    const socketMap = new Map<string, string>();
    const playerIds: string[] = [];

    const pipeline = redisClient.pipeline();

    for (const p of players) {
      playerIds.push(p.userId);
      pipeline.set(`session:user:${p.userId}`, matchId);
      if (p.socketId) {
        socketMap.set(p.userId, p.socketId);
        pipeline.set(`session:socket:${p.socketId}`, matchId);
      }
    }

    const session: ActiveMatchSession = {
      matchId,
      playerIds,
      socketMap,
      status: MATCH_STATUS.ACTIVE,
      createdAt: Date.now(),
    };

    pipeline.set(`session:match:${matchId}`, this.serialize(session));
    await pipeline.exec();

    return session;
  }

  async getSession(matchId: string): Promise<ActiveMatchSession | null> {
    const data = await redisClient.get(`session:match:${matchId}`);
    if (!data) return null;
    return this.deserialize(data);
  }

  async getSessionByUserId(userId: string): Promise<ActiveMatchSession | null> {
    const matchId = await redisClient.get(`session:user:${userId}`);
    if (!matchId) return null;
    return this.getSession(matchId);
  }

  async updatePlayerSocket(userId: string, socketId: string): Promise<void> {
    const matchId = await redisClient.get(`session:user:${userId}`);
    if (!matchId) return;

    const session = await this.getSession(matchId);
    if (session) {
      const oldSocket = session.socketMap.get(userId);
      const pipeline = redisClient.pipeline();
      
      if (oldSocket) {
        pipeline.del(`session:socket:${oldSocket}`);
      }

      session.socketMap.set(userId, socketId);
      pipeline.set(`session:socket:${socketId}`, matchId);
      pipeline.set(`session:match:${matchId}`, this.serialize(session));
      
      await pipeline.exec();
    }
  }

  async handlePlayerDisconnect(socketId: string): Promise<{ matchId?: string; userId?: string }> {
    const matchId = await redisClient.get(`session:socket:${socketId}`);
    if (!matchId) return {};

    await redisClient.del(`session:socket:${socketId}`);
    
    const session = await this.getSession(matchId);
    if (!session) return { matchId };

    let disconnectedUserId: string | undefined;
    for (const [userId, sId] of session.socketMap.entries()) {
      if (sId === socketId) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      session.socketMap.delete(disconnectedUserId);
      await redisClient.set(`session:match:${matchId}`, this.serialize(session));
    }

    return { matchId, userId: disconnectedUserId };
  }

  async isUserInActiveMatch(userId: string): Promise<boolean> {
    const matchId = await redisClient.get(`session:user:${userId}`);
    if (!matchId) return false;
    
    const session = await this.getSession(matchId);
    return !!session && session.status === MATCH_STATUS.ACTIVE;
  }

  async endSession(matchId: string): Promise<void> {
    const session = await this.getSession(matchId);
    if (!session) return;

    const pipeline = redisClient.pipeline();
    
    for (const userId of session.playerIds) {
      pipeline.del(`session:user:${userId}`);
    }
    for (const socketId of session.socketMap.values()) {
      pipeline.del(`session:socket:${socketId}`);
    }
    pipeline.del(`session:match:${matchId}`);
    
    await pipeline.exec();
  }

  async getActiveSessionCount(): Promise<number> {
    // Note: Use SCAN for production
    let cursor = '0';
    let count = 0;
    
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'session:match:*', 'COUNT', 100);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');
    
    return count;
  }
}
