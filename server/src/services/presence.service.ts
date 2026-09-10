import { PLAYER_STATUS, PlayerStatus } from '@nexora/shared';
import { logger } from '../utils/logger';

export class PresenceService {
  // userId -> Set<socketId>
  private userSockets = new Map<string, Set<string>>();
  // socketId -> userId (for quick reverse lookup on disconnect)
  private socketToUser = new Map<string, string>();
  // userId -> PlayerStatus
  private userStatus = new Map<string, PlayerStatus>();

  /**
   * Registers a new socket connection for an authenticated user.
   * Returns true for isFirstConnection if the user was previously offline.
   */
  addConnection(userId: string, socketId: string): { isFirstConnection: boolean; status: PlayerStatus } {
    let sockets = this.userSockets.get(userId);
    const isFirstConnection = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set<string>();
      this.userSockets.set(userId, sockets);
    }

    sockets.add(socketId);
    this.socketToUser.set(socketId, userId);

    // If user was offline, transition to ONLINE
    if (isFirstConnection) {
      this.userStatus.set(userId, PLAYER_STATUS.ONLINE);
      logger.info(`Presence: User ${userId} is now ONLINE (socket: ${socketId})`);
    } else {
      logger.info(`Presence: User ${userId} added auxiliary socket ${socketId} (total: ${sockets.size})`);
    }

    return {
      isFirstConnection,
      status: this.userStatus.get(userId) || PLAYER_STATUS.ONLINE,
    };
  }

  /**
   * Removes a socket connection.
   * Only transitions user to OFFLINE when their final active socket disconnects.
   */
  removeConnection(socketId: string): { userId?: string; isLastConnection: boolean; remainingSockets: number } {
    const userId = this.socketToUser.get(socketId);
    this.socketToUser.delete(socketId);

    if (!userId) {
      return { isLastConnection: false, remainingSockets: 0 };
    }

    const sockets = this.userSockets.get(userId);
    if (!sockets) {
      return { userId, isLastConnection: true, remainingSockets: 0 };
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.userSockets.delete(userId);
      this.userStatus.set(userId, PLAYER_STATUS.OFFLINE);
      logger.info(`Presence: User ${userId} has no remaining sockets. Status is now OFFLINE.`);
      return { userId, isLastConnection: true, remainingSockets: 0 };
    }

    logger.info(`Presence: Socket ${socketId} removed for user ${userId}. User remains ONLINE (${sockets.size} active sockets).`);
    return { userId, isLastConnection: false, remainingSockets: sockets.size };
  }

  setStatus(userId: string, status: PlayerStatus): void {
    this.userStatus.set(userId, status);
    logger.info(`Presence: User ${userId} status updated to ${status}`);
  }

  getStatus(userId: string): PlayerStatus {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      return PLAYER_STATUS.OFFLINE;
    }
    return this.userStatus.get(userId) || PLAYER_STATUS.ONLINE;
  }

  isOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  getOnlineUserIds(): string[] {
    const onlineIds: string[] = [];
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.size > 0) {
        onlineIds.push(userId);
      }
    }
    return onlineIds;
  }

  getOnlineCount(): number {
    return this.getOnlineUserIds().length;
  }

  getUserSockets(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  getPrimarySocket(userId: string): string | undefined {
    const sockets = this.getUserSockets(userId);
    return sockets.length > 0 ? sockets[0] : undefined;
  }
}

export const presenceService = new PresenceService();
