import { PlayerStatus, PLAYER_STATUS } from '@nexora/shared';
import { logger } from '../utils/logger';
import { IPresenceStore, InMemoryPresenceStore, RedisPresenceStore } from '../stores/presence.store';
import { isRedisAvailable } from '../db/redis';

export const presenceStore: IPresenceStore = isRedisAvailable() ? new RedisPresenceStore() : new InMemoryPresenceStore();

export class PresenceService {
  constructor(private store: IPresenceStore = presenceStore) {}

  /**
   * Registers a new socket connection for an authenticated user.
   * Returns true for isFirstConnection if the user was previously offline.
   */
  async addConnection(userId: string, socketId: string): Promise<{ isFirstConnection: boolean; status: PlayerStatus }> {
    const result = await this.store.addConnection(userId, socketId);
    
    if (result.isFirstConnection) {
      logger.info(`Presence: User ${userId} is now ONLINE (socket: ${socketId})`);
    } else {
      logger.info(`Presence: User ${userId} added auxiliary socket ${socketId}`);
    }

    return result;
  }

  /**
   * Removes a socket connection.
   * Only transitions user to OFFLINE when their final active socket disconnects.
   */
  async removeConnection(socketId: string): Promise<{ userId?: string; isLastConnection: boolean; remainingSockets: number }> {
    const result = await this.store.removeConnection(socketId);

    if (result.isLastConnection && result.userId) {
      logger.info(`Presence: User ${result.userId} has no remaining sockets. Status is now OFFLINE.`);
    } else if (result.userId) {
      logger.info(`Presence: Socket ${socketId} removed for user ${result.userId}. User remains ONLINE (${result.remainingSockets} active sockets).`);
    }

    return result;
  }

  async setStatus(userId: string, status: PlayerStatus): Promise<void> {
    await this.store.setStatus(userId, status);
    logger.info(`Presence: User ${userId} status updated to ${status}`);
  }

  async getStatus(userId: string): Promise<PlayerStatus> {
    return this.store.getStatus(userId);
  }

  async isOnline(userId: string): Promise<boolean> {
    return this.store.isOnline(userId);
  }

  async getOnlineUserIds(): Promise<string[]> {
    return this.store.getOnlineUserIds();
  }

  async getOnlineCount(): Promise<number> {
    return this.store.getOnlineCount();
  }

  async getUserSockets(userId: string): Promise<string[]> {
    return this.store.getUserSockets(userId);
  }

  async getPrimarySocket(userId: string): Promise<string | undefined> {
    return this.store.getPrimarySocket(userId);
  }
}

export const presenceService = new PresenceService();
