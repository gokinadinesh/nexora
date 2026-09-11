import { MatchStatus, MATCH_STATUS } from '@nexora/shared';
import { logger } from '../utils/logger';
import { IMatchSessionStore, InMemoryMatchSessionStore, RedisMatchSessionStore, ActiveMatchSession } from '../stores/match-session.store';
import { isRedisAvailable } from '../db/redis';

export const matchSessionStore: IMatchSessionStore = isRedisAvailable() ? new RedisMatchSessionStore() : new InMemoryMatchSessionStore();

export class MatchSessionService {
  constructor(private store: IMatchSessionStore = matchSessionStore) {}

  async createSession(
    matchId: string,
    players: { userId: string; socketId?: string }[]
  ): Promise<ActiveMatchSession> {
    const session = await this.store.createSession(matchId, players);
    logger.info(`MatchSession: Session ${matchId} initialized with ${players.length} players`);
    return session;
  }

  async getSession(matchId: string): Promise<ActiveMatchSession | null> {
    return this.store.getSession(matchId);
  }

  async getSessionByUserId(userId: string): Promise<ActiveMatchSession | null> {
    return this.store.getSessionByUserId(userId);
  }

  async updatePlayerSocket(userId: string, socketId: string): Promise<void> {
    await this.store.updatePlayerSocket(userId, socketId);
    logger.info(`MatchSession: Updated socket for user ${userId} (new socket: ${socketId})`);
  }

  async handlePlayerDisconnect(socketId: string): Promise<{ matchId?: string; userId?: string }> {
    const result = await this.store.handlePlayerDisconnect(socketId);
    if (result.userId && result.matchId) {
      logger.info(`MatchSession: Player ${result.userId} socket disconnected from active match ${result.matchId}`);
    }
    return result;
  }

  async isUserInActiveMatch(userId: string): Promise<boolean> {
    return this.store.isUserInActiveMatch(userId);
  }

  async endSession(matchId: string): Promise<void> {
    await this.store.endSession(matchId);
    logger.info(`MatchSession: Session ${matchId} ended and removed from store`);
  }

  async getActiveSessionCount(): Promise<number> {
    return this.store.getActiveSessionCount();
  }
}

export const matchSessionService = new MatchSessionService();
