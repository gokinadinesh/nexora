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
