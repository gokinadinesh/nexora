import { PlayerStatus, PLAYER_STATUS } from '@nexora/shared';

export interface IPresenceStore {
  addConnection(userId: string, socketId: string): Promise<{ isFirstConnection: boolean; status: PlayerStatus }>;
  removeConnection(socketId: string): Promise<{ userId?: string; isLastConnection: boolean; remainingSockets: number }>;
  setStatus(userId: string, status: PlayerStatus): Promise<void>;
  getStatus(userId: string): Promise<PlayerStatus>;
  isOnline(userId: string): Promise<boolean>;
  getOnlineUserIds(): Promise<string[]>;
  getOnlineCount(): Promise<number>;
  getUserSockets(userId: string): Promise<string[]>;
  getPrimarySocket(userId: string): Promise<string | undefined>;
}

export class InMemoryPresenceStore implements IPresenceStore {
  // userId -> Set<socketId>
  private userSockets = new Map<string, Set<string>>();
  // socketId -> userId (for quick reverse lookup on disconnect)
  private socketToUser = new Map<string, string>();
  // userId -> PlayerStatus
  private userStatus = new Map<string, PlayerStatus>();

  async addConnection(userId: string, socketId: string): Promise<{ isFirstConnection: boolean; status: PlayerStatus }> {
    let sockets = this.userSockets.get(userId);
    const isFirstConnection = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set<string>();
      this.userSockets.set(userId, sockets);
    }

    sockets.add(socketId);
    this.socketToUser.set(socketId, userId);

    if (isFirstConnection) {
      this.userStatus.set(userId, PLAYER_STATUS.ONLINE);
    }

    return {
      isFirstConnection,
      status: this.userStatus.get(userId) || PLAYER_STATUS.ONLINE,
    };
  }

  async removeConnection(socketId: string): Promise<{ userId?: string; isLastConnection: boolean; remainingSockets: number }> {
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
      return { userId, isLastConnection: true, remainingSockets: 0 };
    }

    return { userId, isLastConnection: false, remainingSockets: sockets.size };
  }

  async setStatus(userId: string, status: PlayerStatus): Promise<void> {
    this.userStatus.set(userId, status);
  }

  async getStatus(userId: string): Promise<PlayerStatus> {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      return PLAYER_STATUS.OFFLINE;
    }
    return this.userStatus.get(userId) || PLAYER_STATUS.ONLINE;
  }

  async isOnline(userId: string): Promise<boolean> {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  async getOnlineUserIds(): Promise<string[]> {
    const onlineIds: string[] = [];
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.size > 0) {
        onlineIds.push(userId);
      }
    }
    return onlineIds;
  }

  async getOnlineCount(): Promise<number> {
    return (await this.getOnlineUserIds()).length;
  }

  async getUserSockets(userId: string): Promise<string[]> {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  async getPrimarySocket(userId: string): Promise<string | undefined> {
    const sockets = await this.getUserSockets(userId);
    return sockets.length > 0 ? sockets[0] : undefined;
  }
}
