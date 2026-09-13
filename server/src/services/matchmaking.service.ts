import {
  GAME_EVENTS,
  PLAYER_STATUS,
  QUEUE_STATUS,
  QueueStatus,
  QueueEntry,
  MatchmakingJoinResponse,
  MatchFoundPayload,
  LEVELS,
} from '@nexora/shared';
import { presenceService } from './presence.service';
import { matchService } from './match.service';
import { matchSessionService } from './match-session.service';
import { userRepository } from '../repositories/user.repository';
import { matchRepository } from '../repositories/match.repository';
import { getSocketServer } from '../sockets';
import { lobbyService } from './lobby.service';
import { logger } from '../utils/logger';
import { IMatchmakingStore, InMemoryMatchmakingStore, RedisMatchmakingStore } from '../stores/matchmaking.store';
import { isRedisAvailable } from '../db/redis';

export const matchmakingStore: IMatchmakingStore = isRedisAvailable() ? new RedisMatchmakingStore() : new InMemoryMatchmakingStore();

export class MatchmakingService {
  private tickInterval: NodeJS.Timeout | null = null;

  constructor(private store: IMatchmakingStore = matchmakingStore) {
    this.startBackgroundTick();
  }

  private startBackgroundTick() {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      this.processQueueTick().catch(err => {
        logger.error('Matchmaking background tick error:', err);
      });
    }, 3000);
  }

  private async processQueueTick() {
    // Attempt to match players who are sitting in the queue.
    // We only need to trigger matching if there are enough players for a mode.
    const queue = await this.store.getQueue();
    if (queue.length < 2) return; // No matches possible

    // Sort queue by oldest first
    const sortedQueue = [...queue].sort((a, b) => a.queuedAt - b.queuedAt);

    for (const candidate of sortedQueue) {
      // Re-evaluate candidate as if they just joined, using atomicMatchOrEnqueue
      // But we must NOT re-enqueue them if they fail (they are already in queue).
      
      const neededOpponents = candidate.mode === 'FFA' ? 9 : candidate.mode === '4P' ? 3 : 1;
      
      // We only try if there are enough people of the same mode
      const sameModeCount = queue.filter(q => q.mode === candidate.mode).length;
      if (sameModeCount < neededOpponents + 1) continue;

      // Check if we can form a match
      await this.tryMatchCandidate(candidate);
    }
  }

  private async tryMatchCandidate(candidate: QueueEntry) {
    // Wait for queue lock
    while (!(await this.store.lockQueue())) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    try {
      const queue = await this.store.getQueue();
      // Ensure candidate is still in queue
      if (!queue.find(q => q.userId === candidate.userId)) return;

      const neededOpponents = candidate.mode === 'FFA' ? 9 : candidate.mode === '4P' ? 3 : 1;
      const opponentIndices = this.findOpponentsIndices(queue, candidate, neededOpponents);

      if (opponentIndices.length === neededOpponents) {
        // Matched!
        const opponents = opponentIndices.map(idx => queue[idx]);
        
        // Remove everyone from queue
        const matchUserIds = new Set([candidate.userId, ...opponents.map(o => o.userId)]);
        const newQueue = queue.filter(q => !matchUserIds.has(q.userId));
        await this.store.setQueue(newQueue); 
        
        const allPlayers = [candidate, ...opponents]; // Note: candidate might be placed first here. It's fine.
        
        logger.info(`Matchmaking (Background): Match found for players: ${allPlayers.map(p => p.username).join(', ')} [Mode: ${candidate.mode}]`);

        const level = candidate.mode === 'FFA' ? LEVELS.LEVEL_FFA_LARGE : candidate.mode === '4P' ? LEVELS.LEVEL_4P_MEDIUM : LEVELS.LEVEL_1v1_SMALL;

        // Create match in DB & active session
        const { match, matchFoundPayload } = await matchService.createMatch(level, allPlayers);

        // Record metrics and operational event
        const { metricsService } = await import('../monitoring/metrics.service');
        const { eventsService } = await import('../monitoring/events.service');
        metricsService.recordMatchStarted();
        eventsService.recordEvent({
          type: 'MATCH_CREATED',
          matchId: match.id,
          metadata: {
            players: allPlayers.map(p => p.username),
          },
        });

        // Update player statuses to IN_GAME
        for (const p of allPlayers) {
          await presenceService.setStatus(p.userId, PLAYER_STATUS.IN_GAME);
          lobbyService.broadcastPresence(p.userId, p.username, PLAYER_STATUS.IN_GAME);
        }

        // Socket.IO Room Allocation
        try {
          const io = getSocketServer();
          const matchRoom = `match:${match.id}`;

          for (const p of allPlayers) {
            const socket = io.sockets.sockets.get(p.socketId);
            if (socket) {
              socket.join(matchRoom);
              socket.emit(GAME_EVENTS.MATCH_FOUND, matchFoundPayload);
            }
          }

          io.to(matchRoom).emit(GAME_EVENTS.QUEUE_STATUS, {
            status: QUEUE_STATUS.MATCH_FOUND,
            matchId: match.id,
          });
        } catch (socketErr) {
          logger.warn('Matchmaking: Socket notification warning:', socketErr);
        }
      }
    } finally {
      await this.store.unlockQueue();
    }
  }

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
    const activeSession = await matchSessionService.getSessionByUserId(userId);
    if (activeSession) {
      // Check if match is already finalized in the DB
      const resultDetails = await matchRepository.findMatchResultById(activeSession.matchId);
      if (resultDetails) {
        // Ghost session detected, clear it
        await matchSessionService.endSession(activeSession.matchId);
      } else {
        return {
          eligible: false,
          errorCode: 'ALREADY_IN_MATCH',
          message: 'You are already in an active match session',
        };
      }
    }

    return { eligible: true };
  }

  /**
   * Places an authenticated player into matchmaking and attempts matching immediately.
   */
  async joinQueue(userId: string, socketId: string, mode: import('@nexora/shared').GameMode = '1v1'): Promise<MatchmakingJoinResponse> {
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
      mode,
    };

    logger.info(`Matchmaking: Operative ${newEntry.username} (Rating: ${newEntry.rating}) entering queue [Mode: ${mode}]`);

    const { eventsService } = await import('../monitoring/events.service');
    eventsService.recordEvent({
      type: 'QUEUE_JOINED',
      userId: newEntry.userId,
      username: newEntry.username,
      metadata: { rating: newEntry.rating, mode },
    });

    return await this.atomicMatchOrEnqueue(newEntry);
  }

  private async atomicMatchOrEnqueue(newEntry: QueueEntry): Promise<MatchmakingJoinResponse> {
    // Wait for queue lock
    while (!(await this.store.lockQueue())) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    try {
      const queue = await this.store.getQueue();
      
      const neededOpponents = newEntry.mode === 'FFA' ? 9 : newEntry.mode === '4P' ? 3 : 1;
      const opponentIndices = this.findOpponentsIndices(queue, newEntry, neededOpponents);

      if (opponentIndices.length === neededOpponents) {
        // Matched! Extract opponents.
        const opponents = opponentIndices.map(idx => queue[idx]);
        const newQueue = queue.filter((_, idx) => !opponentIndices.includes(idx));
        await this.store.setQueue(newQueue); 
        
        const allPlayers = [...opponents, newEntry];
        
        logger.info(`Matchmaking: Match found for players: ${allPlayers.map(p => p.username).join(', ')} [Mode: ${newEntry.mode}]`);

        const level = newEntry.mode === 'FFA' ? LEVELS.LEVEL_FFA_LARGE : newEntry.mode === '4P' ? LEVELS.LEVEL_4P_MEDIUM : LEVELS.LEVEL_1v1_SMALL;

        // Create match in DB & active session
        const { match, matchFoundPayload } = await matchService.createMatch(level, allPlayers);

        // Record metrics and operational event
        const { metricsService } = await import('../monitoring/metrics.service');
        const { eventsService } = await import('../monitoring/events.service');
        metricsService.recordMatchStarted();
        eventsService.recordEvent({
          type: 'MATCH_CREATED',
          matchId: match.id,
          metadata: {
            players: allPlayers.map(p => p.username),
          },
        });

        // Update player statuses to IN_GAME
        for (const p of allPlayers) {
          await presenceService.setStatus(p.userId, PLAYER_STATUS.IN_GAME);
          lobbyService.broadcastPresence(p.userId, p.username, PLAYER_STATUS.IN_GAME);
        }

        // Socket.IO Room Allocation
        try {
          const io = getSocketServer();
          const matchRoom = `match:${match.id}`;

          for (const p of allPlayers) {
            const socket = io.sockets.sockets.get(p.socketId);
            if (socket) {
              socket.join(matchRoom);
              socket.emit(GAME_EVENTS.MATCH_FOUND, matchFoundPayload);
              logger.info(`Matchmaking: socket for ${p.username} (${p.socketId}) successfully notified.`);
            } else {
              logger.warn(`Matchmaking: socket NOT FOUND for ${p.username} (${p.socketId})!`);
            }
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

  private findOpponentsIndices(queue: QueueEntry[], candidate: QueueEntry, needed: number): number[] {
    const now = Date.now();
    const indices: number[] = [];

    for (let i = 0; i < queue.length; i++) {
      if (indices.length === needed) break;

      const waiting = queue[i];
      if (waiting.userId === candidate.userId) continue;
      if (waiting.mode !== candidate.mode) continue;

      const waitDuration = now - waiting.queuedAt;
      const ratingDiff = Math.abs(waiting.rating - candidate.rating);

      let allowedDiff = 150;
      if (waitDuration > 5000) allowedDiff = 300;
      if (waitDuration > 10000) allowedDiff = 800;

      if (ratingDiff <= allowedDiff) {
        indices.push(i);
      }
    }

    if (indices.length === needed) {
      return indices;
    }
    return [];
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
