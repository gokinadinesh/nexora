import { MatchStatus, MATCH_STATUS } from '@nexora/shared';
import { logger } from '../utils/logger';

export interface ActiveMatchSession {
  matchId: string;
  playerIds: string[];
  socketMap: Map<string, string>; // userId -> socketId
  status: MatchStatus;
  createdAt: number;
}

export class MatchSessionService {
  // matchId -> ActiveMatchSession
  private sessions = new Map<string, ActiveMatchSession>();
  // userId -> matchId
  private userToMatch = new Map<string, string>();
  // socketId -> matchId
  private socketToMatch = new Map<string, string>();

  createSession(
    matchId: string,
    players: { userId: string; socketId?: string }[]
  ): ActiveMatchSession {
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
    logger.info(`MatchSession: Session ${matchId} initialized with ${players.length} players`);
    return session;
  }

  getSession(matchId: string): ActiveMatchSession | null {
    return this.sessions.get(matchId) || null;
  }

  getSessionByUserId(userId: string): ActiveMatchSession | null {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return null;
    return this.sessions.get(matchId) || null;
  }

  updatePlayerSocket(userId: string, socketId: string): void {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;

    const session = this.sessions.get(matchId);
    if (session) {
      // Remove old socket mapping if exists
      const oldSocket = session.socketMap.get(userId);
      if (oldSocket) {
        this.socketToMatch.delete(oldSocket);
      }

      session.socketMap.set(userId, socketId);
      this.socketToMatch.set(socketId, matchId);
      logger.info(`MatchSession: Updated socket for user ${userId} in match ${matchId} (new socket: ${socketId})`);
    }
  }

  handlePlayerDisconnect(socketId: string): { matchId?: string; userId?: string } {
    const matchId = this.socketToMatch.get(socketId);
    if (!matchId) return {};

    this.socketToMatch.delete(socketId);
    const session = this.sessions.get(matchId);
    if (!session) return { matchId };

    // Find user for this socket
    let disconnectedUserId: string | undefined;
    for (const [userId, sId] of session.socketMap.entries()) {
      if (sId === socketId) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      session.socketMap.delete(disconnectedUserId);
      logger.info(`MatchSession: Player ${disconnectedUserId} socket disconnected from active match ${matchId}`);
    }

    return { matchId, userId: disconnectedUserId };
  }

  isUserInActiveMatch(userId: string): boolean {
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return false;
    const session = this.sessions.get(matchId);
    return !!session && session.status === MATCH_STATUS.ACTIVE;
  }

  endSession(matchId: string): void {
    const session = this.sessions.get(matchId);
    if (!session) return;

    for (const userId of session.playerIds) {
      this.userToMatch.delete(userId);
    }
    for (const socketId of session.socketMap.values()) {
      this.socketToMatch.delete(socketId);
    }

    this.sessions.delete(matchId);
    logger.info(`MatchSession: Session ${matchId} ended and removed from memory`);
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export const matchSessionService = new MatchSessionService();
