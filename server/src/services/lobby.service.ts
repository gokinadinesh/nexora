import { GAME_EVENTS, LobbyPlayer, LobbyResponse, PlayerStatus } from '@nexora/shared';
import { presenceService } from './presence.service';
import { userRepository } from '../repositories/user.repository';
import { getSocketServer } from '../sockets';
import { logger } from '../utils/logger';

export class LobbyService {
  /**
   * Retrieves current safe lobby statistics and active player records.
   * Strictly omits emails, passwords, and private credentials.
   */
  async getLobbyData(): Promise<LobbyResponse> {
    const onlineIds = presenceService.getOnlineUserIds();
    const users = await userRepository.findByIds(onlineIds);

    const players: LobbyPlayer[] = users.map((u) => {
      const status = presenceService.getStatus(u.id);
      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.username,
        avatar: u.avatar || 'default_operative',
        rating: u.rating !== undefined ? Number(u.rating) : 1000,
        status,
      };
    });

    return {
      playersOnline: players.length,
      players,
    };
  }

  /**
   * Broadcasts real-time player presence updates to connected sockets in the lobby.
   */
  broadcastPresence(userId: string, username: string, status: PlayerStatus): void {
    try {
      const io = getSocketServer();
      const payload = {
        userId,
        username,
        status,
        timestamp: Date.now(),
      };

      if (status === 'ONLINE') {
        io.emit(GAME_EVENTS.PLAYER_ONLINE, payload);
      } else if (status === 'OFFLINE') {
        io.emit(GAME_EVENTS.PLAYER_OFFLINE, payload);
      }
      io.emit(GAME_EVENTS.PLAYER_STATUS_CHANGED, payload);
    } catch (err) {
      // Socket server might not be initialized yet during startup or tests
      logger.debug('Lobby broadcast skipped (socket server uninitialized):', err);
    }
  }
}

export const lobbyService = new LobbyService();
