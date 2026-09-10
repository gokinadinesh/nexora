import {
  GAME_EVENTS,
  PLAYER_STATUS,
  QUEUE_STATUS,
  QueueStatus,
  QueueEntry,
  MatchmakingJoinResponse,
  MatchFoundPayload,
} from '@nexora/shared';
import { presenceService } from './presence.service';
import { matchService } from './match.service';
import { matchSessionService } from './match-session.service';
import { userRepository } from '../repositories/user.repository';
import { getSocketServer } from '../sockets';
import { lobbyService } from './lobby.service';
import { logger } from '../utils/logger';
import { IMatchmakingStore, InMemoryMatchmakingStore } from '../stores/matchmaking.store';

export const matchmakingStore: IMatchmakingStore = new InMemoryMatchmakingStore();

export class MatchmakingService {
  constructor(private store: IMatchmakingStore = matchmakingStore) {}

  /**
   * Evaluates if a player is eligible to join the matchmaking queue.
   */
  async checkEligibility(userId: string): Promise<{ eligible: boolean; errorCode?: string; message?: string }> {
    // 1. Online check
    const isOnline = await presenceService.isOnline(userId);
    if (!isOnline) {
      return {
        eligible: false,
        errorCode: 'PLAYER_OFFLINE',
        message: 'You must have an active connection to join matchmaking',
      };
    }

    // 2. Already queued check
    const queue = await this.store.getQueue();
    const isQueued = queue.some((entry) => entry.userId === userId);
    if (isQueued) {
      return {
        eligible: false,
        errorCode: 'ALREADY_QUEUED',
        message: 'You are already in the matchmaking queue',
      };
    }

    // 3. Active match check
    const isInMatch = await matchSessionService.isUserInActiveMatch(userId);
    if (isInMatch) {
      return {
        eligible: false,
        errorCode: 'ALREADY_IN_MATCH',
        message: 'You are already in an active match session',
      };
    }

    return { eligible: true };
  }

  /**
   * Places an authenticated player into matchmaking and attempts matching immediately.
   */
  async joinQueue(userId: string, socketId: string): Promise<MatchmakingJoinResponse> {
    // Check eligibility
    const eligibility = await this.checkEligibility(userId);
    if (!eligibility.eligible) {
      const err: any = new Error(eligibility.message);
      err.statusCode = 400;
      err.code = eligibility.errorCode;
      throw err;
    }

    // Retrieve trusted player profile from database
    const user = await userRepository.findById(userId);
    if (!user) {
      const err: any = new Error('Operative profile not found');
      err.statusCode = 404;
      throw err;
    }

    const newEntry: QueueEntry = {
      userId: user.id,
      socketId,
      username: user.username,
      displayName: user.display_name || user.username,
      avatar: user.avatar || 'default_operative',
      rating: user.rating ?? 1000,
      queuedAt: Date.now(),
    };

    logger.info(`Matchmaking: Operative ${newEntry.username} (Rating: ${newEntry.rating}) entering queue`);

    const { eventsService } = await import('../monitoring/events.service');
    eventsService.recordEvent({
      type: 'QUEUE_JOINED',
      userId: newEntry.userId,
      username: newEntry.username,
      metadata: { rating: newEntry.rating },
    });

    return await this.atomicMatchOrEnqueue(newEntry);
  }

  private async atomicMatchOrEnqueue(newEntry: QueueEntry): Promise<MatchmakingJoinResponse> {
    // Wait for queue lock
    while (!(await this.store.lockQueue())) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    try {
      // Find suitable opponent in queue
      const queue = await this.store.getQueue();
      const opponentIndex = this.findBestOpponentIndex(queue, newEntry);

      if (opponentIndex !== -1) {
        // Matched!
        const opponent = queue.splice(opponentIndex, 1)[0];
        await this.store.setQueue(queue); // Update queue after removing opponent
        
        logger.info(`Matchmaking: Match found between ${newEntry.username} and ${opponent.username}!`);

        // Create match in DB & active session
        const { match, matchFoundPayload } = await matchService.createMatch(opponent, newEntry);

        // Record metrics and operational event
        const { metricsService } = await import('../monitoring/metrics.service');
        const { eventsService } = await import('../monitoring/events.service');
        metricsService.recordMatchStarted();
        eventsService.recordEvent({
          type: 'MATCH_CREATED',
          matchId: match.id,
          metadata: {
            player1: opponent.username,
            player2: newEntry.username,
          },
        });

        // Update player statuses to IN_GAME
        await presenceService.setStatus(opponent.userId, PLAYER_STATUS.IN_GAME);
        await presenceService.setStatus(newEntry.userId, PLAYER_STATUS.IN_GAME);
        lobbyService.broadcastPresence(opponent.userId, opponent.username, PLAYER_STATUS.IN_GAME);
        lobbyService.broadcastPresence(newEntry.userId, newEntry.username, PLAYER_STATUS.IN_GAME);

        // Socket.IO Room Allocation
        try {
          const io = getSocketServer();
          const matchRoom = `match:${match.id}`;

          const socketOpponent = io.sockets.sockets.get(opponent.socketId);
          const socketNewPlayer = io.sockets.sockets.get(newEntry.socketId);

          if (socketOpponent) {
            socketOpponent.join(matchRoom);
            socketOpponent.emit(GAME_EVENTS.MATCH_FOUND, matchFoundPayload);
          }

          if (socketNewPlayer) {
            socketNewPlayer.join(matchRoom);
            socketNewPlayer.emit(GAME_EVENTS.MATCH_FOUND, matchFoundPayload);
          }

          io.to(matchRoom).emit(GAME_EVENTS.QUEUE_STATUS, {
            status: QUEUE_STATUS.MATCH_FOUND,
            matchId: match.id,
          });

          logger.info(`Matchmaking: Sockets joined room ${matchRoom} and notified of MATCH_FOUND`);
        } catch (socketErr) {
          logger.warn('Matchmaking: Socket notification warning:', socketErr);
        }

        return {
          status: QUEUE_STATUS.MATCH_FOUND,
          matchId: match.id,
          match: matchFoundPayload,
        };
      }

      // No opponent found -> add to waiting queue
      await this.store.enqueue(newEntry);
      const queueLength = await this.store.getQueueLength();
      
      await presenceService.setStatus(newEntry.userId, PLAYER_STATUS.QUEUED);
      lobbyService.broadcastPresence(newEntry.userId, newEntry.username, PLAYER_STATUS.QUEUED);

      try {
        const io = getSocketServer();
        const socket = io.sockets.sockets.get(newEntry.socketId);
        if (socket) {
          socket.emit(GAME_EVENTS.QUEUE_STATUS, {
            status: QUEUE_STATUS.QUEUED,
            queuePosition: queueLength,
            queuedAt: newEntry.queuedAt,
          });
        }
      } catch (err) {
        // Socket emission failure is non-fatal to REST response
      }

      return {
        status: QUEUE_STATUS.QUEUED,
        queuePosition: queueLength,
      };
    } finally {
      await this.store.unlockQueue();
    }
  }

  /**
   * Rating-aware FIFO matching strategy.
   * Checks queue from oldest to newest with rating tolerance.
   */
  private findBestOpponentIndex(queue: QueueEntry[], candidate: QueueEntry): number {
    const now = Date.now();

    for (let i = 0; i < queue.length; i++) {
      const waiting = queue[i];
      if (waiting.userId === candidate.userId) continue;

      const waitDuration = now - waiting.queuedAt;
      const ratingDiff = Math.abs(waiting.rating - candidate.rating);

      let allowedDiff = 150;
      if (waitDuration > 5000) allowedDiff = 300;
      if (waitDuration > 10000) allowedDiff = 10000;

      if (ratingDiff <= allowedDiff) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Removes a player from the matchmaking queue.
   */
  async leaveQueue(userId: string): Promise<{ status: QueueStatus }> {
    const removed = await this.store.dequeue(userId);

    if (removed) {
      await presenceService.setStatus(userId, PLAYER_STATUS.ONLINE);
      const user = await userRepository.findById(userId);
      if (user) {
        lobbyService.broadcastPresence(user.id, user.username, PLAYER_STATUS.ONLINE);
      }
      logger.info(`Matchmaking: User ${userId} removed from queue`);
    }

    return { status: QUEUE_STATUS.NOT_QUEUED };
  }

  /**
   * Handles player disconnection by safely removing them from queue.
   */
  async handleDisconnect(userId: string, socketId?: string): Promise<void> {
    const queue = await this.store.getQueue();
    const wasQueued = queue.some(
      (entry) => entry.userId === userId || (socketId && entry.socketId === socketId)
    );

    if (wasQueued) {
      const newQueue = queue.filter(
        (entry) => entry.userId !== userId && (!socketId || entry.socketId !== socketId)
      );
      await this.store.setQueue(newQueue);
      logger.info(`Matchmaking: Disconnected user ${userId} removed from queue`);
    }
  }

  /**
   * Gets current queue status for a player.
   */
  async getQueueStatus(userId: string): Promise<{ status: QueueStatus; queuePosition?: number; queuedAt?: number }> {
    const queue = await this.store.getQueue();
    const index = queue.findIndex((entry) => entry.userId === userId);
    
    if (index !== -1) {
      const entry = queue[index];
      return {
        status: QUEUE_STATUS.QUEUED,
        queuePosition: index + 1,
        queuedAt: entry.queuedAt,
      };
    }

    const inMatch = await matchSessionService.isUserInActiveMatch(userId);
    if (inMatch) {
      return {
        status: QUEUE_STATUS.MATCH_FOUND,
      };
    }

    return { status: QUEUE_STATUS.NOT_QUEUED };
  }

  async getQueueLength(): Promise<number> {
    return this.store.getQueueLength();
  }

  async getQueueSize(): Promise<number> {
    return this.store.getQueueLength();
  }

  async clearQueue(): Promise<void> {
    return this.store.clearQueue();
  }
}

export const matchmakingService = new MatchmakingService();
