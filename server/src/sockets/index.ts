import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { authService } from '../services/auth.service';
import { presenceService } from '../services/presence.service';
import { lobbyService } from '../services/lobby.service';
import { GAME_EVENTS, QUEUE_STATUS } from '@nexora/shared';
import { matchmakingService } from '../services/matchmaking.service';
import { matchSessionService } from '../services/match-session.service';
import { matchService } from '../services/match.service';
import { matchFinalizationService } from '../services/match-finalization.service';
import { gameEngine } from '../game';
import { metricsService } from '../monitoring/metrics.service';
import { eventsService } from '../monitoring/events.service';
import { securityService } from '../security/security.service';
import { anomalyService } from '../security/anomaly.service';

let io: SocketIOServer | null = null;
let metricsInterval: NodeJS.Timeout | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Authentication Middleware Preparation
  io.use((socket, next) => {
    const rawAuth = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const token = typeof rawAuth === 'string' ? rawAuth.replace(/^Bearer\s+/i, '').trim() : undefined;

    if (token) {
      try {
        const user = authService.verifyToken(token);
        socket.data.user = user;
        socket.data.userId = user.id;
        return next();
      } catch (err: any) {
        // Record security telemetry on invalid JWT connection attempt
        securityService.recordSecurityEvent({
          type: 'INVALID_JWT',
          severity: 'MEDIUM',
          context: {
            socketId: socket.id,
            error: err.message,
          },
        });
        // Cleanly reject invalid credentials
        return next(new Error('Authentication error: Invalid or expired token'));
      }
    }

    // Preserve existing connection lifecycle when no token is provided
    next();
  });

  // Periodic metrics broadcaster to operator room
  if (!metricsInterval) {
    metricsInterval = setInterval(() => {
      if (io && io.sockets.adapter.rooms.get('monitoring')?.size) {
        io.to('monitoring').emit(GAME_EVENTS.MONITORING_METRICS_UPDATED, metricsService.getMetrics());
      }
    }, 2000);
  }

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    metricsService.incrementWebsocket();

    if (user) {
      const { isFirstConnection } = presenceService.addConnection(user.id, socket.id);
      logger.info('player socket connected', `[id: ${socket.id}, user: ${user.username}]`);

      eventsService.recordEvent({
        type: 'USER_CONNECTED',
        userId: user.id,
        username: user.username,
      });

      if (isFirstConnection) {
        lobbyService.broadcastPresence(user.id, user.username, 'ONLINE');
      }

      // Re-link socket if user has an active match session
      const activeSession = matchSessionService.getSessionByUserId(user.id);
      if (activeSession) {
        matchSessionService.updatePlayerSocket(user.id, socket.id);
        socket.join(`match:${activeSession.matchId}`);
      }

      // Operator Monitoring Subscription Handlers
      socket.on(GAME_EVENTS.MONITORING_SUBSCRIBE, () => {
        if (user.role === 'OPERATOR') {
          socket.join('monitoring');
          logger.info(`Monitoring: Operator ${user.username} subscribed to monitoring stream`);
          socket.emit(GAME_EVENTS.MONITORING_METRICS_UPDATED, metricsService.getMetrics());
        } else {
          securityService.recordSecurityEvent({
            type: 'UNAUTHORIZED_ACCESS',
            severity: 'HIGH',
            userId: user.id,
            username: user.username,
            context: {
              action: 'MONITORING_SUBSCRIBE',
              role: user.role,
            },
          });
          anomalyService.recordAuthFailure(user.id, 'Unauthorized monitoring stream subscription', user.username);
          socket.emit('MONITORING_ERROR', {
            message: 'Forbidden: Operator authorization required for monitoring stream',
          });
        }
      });

      socket.on(GAME_EVENTS.MONITORING_UNSUBSCRIBE, () => {
        socket.leave('monitoring');
      });

      // Matchmaking Events
      socket.on(GAME_EVENTS.QUEUE_JOINED, async () => {
        try {
          const result = await matchmakingService.joinQueue(user.id, socket.id);
          socket.emit(GAME_EVENTS.QUEUE_STATUS, result);
        } catch (err: any) {
          socket.emit(GAME_EVENTS.QUEUE_STATUS, {
            status: QUEUE_STATUS.NOT_QUEUED,
            error: err.message,
            code: err.code || 'MATCHMAKING_ERROR',
          });
        }
      });

      socket.on(GAME_EVENTS.QUEUE_LEFT, () => {
        const result = matchmakingService.leaveQueue(user.id);
        eventsService.recordEvent({
          type: 'QUEUE_LEFT',
          userId: user.id,
          username: user.username,
        });
        socket.emit(GAME_EVENTS.QUEUE_STATUS, result);
      });

      socket.on(GAME_EVENTS.QUEUE_STATUS, () => {
        const status = matchmakingService.getQueueStatus(user.id);
        socket.emit(GAME_EVENTS.QUEUE_STATUS, status);
      });

      // Match Session Room Joining & State Synchronization
      socket.on(GAME_EVENTS.PLAYER_JOINED, async (payload: { matchId: string }) => {
        if (!payload?.matchId) return;

        try {
          const isMember = await matchService.isUserInMatch(payload.matchId, user.id);
          if (isMember) {
            const matchRoom = `match:${payload.matchId}`;
            socket.join(matchRoom);
            matchSessionService.updatePlayerSocket(user.id, socket.id);

            // Record operational event
            eventsService.recordEvent({
              type: 'PLAYER_JOINED',
              matchId: payload.matchId,
              userId: user.id,
              username: user.username,
            });

            // Notify room that player is connected to the match room
            io?.to(matchRoom).emit(GAME_EVENTS.PLAYER_JOINED, {
              userId: user.id,
              username: user.username,
              matchId: payload.matchId,
              timestamp: Date.now(),
            });

            // Send authoritative initial game state
            const gameState = gameEngine.getGameState(payload.matchId);
            if (gameState) {
              socket.emit(GAME_EVENTS.GAME_STARTED, { matchId: payload.matchId, state: gameState });
              socket.emit(GAME_EVENTS.GAME_STATE_UPDATED, gameState);
            }

            logger.info(`MatchSession: User ${user.username} joined match room ${matchRoom}`);
          } else {
            logger.warn(`Security: User ${user.username} denied access to match ${payload.matchId}`);
            securityService.recordSecurityEvent({
              type: 'FORBIDDEN_MATCH_ACCESS',
              severity: 'HIGH',
              userId: user.id,
              username: user.username,
              context: { matchId: payload.matchId },
            });
            anomalyService.recordAuthFailure(user.id, `Forbidden access to match ${payload.matchId}`, user.username);
          }
        } catch (err) {
          logger.error('Error handling PLAYER_JOINED event:', err);
        }
      });

      // Server-Authoritative Real-Time Action Resolution
      socket.on(GAME_EVENTS.PLAYER_ACTION, async (action: any) => {
        const startTime = Date.now();

        if (!action || !action.matchId) {
          metricsService.recordAction(Date.now() - startTime, false);
          socket.emit(GAME_EVENTS.ACTION_REJECTED, {
            actionId: action?.actionId,
            reason: 'Invalid action payload',
            code: 'INVALID_TARGET',
          });
          return;
        }

        try {
          const isMember = await matchService.isUserInMatch(action.matchId, user.id);
          if (!isMember) {
            metricsService.recordAction(Date.now() - startTime, false);
            securityService.recordSecurityEvent({
              type: 'FORBIDDEN_MATCH_ACCESS',
              severity: 'HIGH',
              userId: user.id,
              username: user.username,
              context: { matchId: action.matchId, actionId: action.actionId },
            });
            anomalyService.recordAuthFailure(user.id, `Unauthorized match action on ${action.matchId}`, user.username);

            socket.emit(GAME_EVENTS.ACTION_REJECTED, {
              actionId: action.actionId,
              reason: 'Unauthorized: You are not a participant in this match session',
              code: 'UNAUTHORIZED',
            });
            return;
          }

          const result = gameEngine.processAction(action.matchId, user.id, action);
          const duration = Date.now() - startTime;
          const matchRoom = `match:${action.matchId}`;

          // Record performance and operational telemetry
          metricsService.recordAction(duration, true);
          eventsService.recordEvent({
            type: 'PLAYER_ACTION',
            matchId: action.matchId,
            userId: user.id,
            username: user.username,
            duration,
            metadata: { actionType: action.type, eventType: result.actionResult.eventType },
          });

          if (result.actionResult.eventType === GAME_EVENTS.NODE_CAPTURED) {
            eventsService.recordEvent({
              type: 'NODE_CAPTURED',
              matchId: action.matchId,
              userId: user.id,
              username: user.username,
              metadata: { targetNodeId: result.actionResult.targetNodeId },
            });
          } else if (result.actionResult.eventType === GAME_EVENTS.PLAYER_ATTACKED) {
            eventsService.recordEvent({
              type: 'PLAYER_ATTACKED',
              matchId: action.matchId,
              userId: user.id,
              username: user.username,
            });
          } else if (result.actionResult.eventType === GAME_EVENTS.PLAYER_DEFENDED) {
            eventsService.recordEvent({
              type: 'PLAYER_DEFENDED',
              matchId: action.matchId,
              userId: user.id,
              username: user.username,
            });
          }

          anomalyService.recordAction(user.id, user.username);

          // 1. Broadcast specific action event (PLAYER_MOVE, NODE_CAPTURED, etc.)
          io?.to(matchRoom).emit(result.actionResult.eventType, {
            playerId: user.id,
            actionId: action.actionId,
            type: result.actionResult.type,
            targetNodeId: result.actionResult.targetNodeId,
            scoreDelta: result.actionResult.scoreDelta,
            message: result.actionResult.message,
            timestamp: Date.now(),
          });

          // 2. Broadcast score update if score changed
          if (result.actionResult.scoreDelta > 0) {
            io?.to(matchRoom).emit(GAME_EVENTS.SCORE_UPDATED, {
              playerId: user.id,
              score: result.state.players[user.id]?.score ?? 0,
              scoreDelta: result.actionResult.scoreDelta,
            });
          }

          // 3. Broadcast Authoritative Game State to both players
          io?.to(matchRoom).emit(GAME_EVENTS.GAME_STATE_UPDATED, result.state);

          // 4. Handle Game End condition
          if (result.isGameOver) {
            metricsService.recordMatchCompleted();
            eventsService.recordEvent({
              type: 'MATCH_COMPLETED',
              matchId: action.matchId,
              metadata: { winnerId: result.winnerId },
            });

            let matchResult = null;
            try {
              const scores: Record<string, number> = {};
              for (const pid of Object.keys(result.state.players)) {
                scores[pid] = result.state.players[pid].score;
              }
              matchResult = await matchFinalizationService.finalizeMatch({
                matchId: action.matchId,
                winnerId: result.winnerId ?? null,
                scores,
                finalVersion: result.state.version,
              });
            } catch (finErr: any) {
              logger.error(`GameEngine: Error finalizing match ${action.matchId}:`, finErr);
              metricsService.recordError();
            }

            io?.to(matchRoom).emit(GAME_EVENTS.GAME_ENDED, {
              matchId: action.matchId,
              winnerId: result.winnerId,
              state: result.state,
              result: matchResult,
            });
            logger.info(`GameEngine: Finalized and broadcast GAME_ENDED for match ${action.matchId}`);
          }
        } catch (err: any) {
          const duration = Date.now() - startTime;
          metricsService.recordAction(duration, false);

          logger.warn(`GameEngine: Action ${action?.actionId} rejected for user ${user.username}: ${err.message}`);

          eventsService.recordEvent({
            type: 'ACTION_REJECTED',
            matchId: action?.matchId,
            userId: user.id,
            username: user.username,
            duration,
            reason: err.message,
            metadata: { code: err.code || 'INVALID_MOVE', actionId: action?.actionId },
          });

          // Security telemetry based on rejection type
          if (err.code === 'RATE_LIMITED') {
            securityService.recordSecurityEvent({
              type: 'RATE_LIMIT_VIOLATION',
              severity: 'LOW',
              userId: user.id,
              username: user.username,
              context: { actionId: action?.actionId, matchId: action?.matchId },
            });
            anomalyService.recordAction(user.id, user.username);
          } else if (err.code === 'NOT_YOUR_TURN') {
            securityService.recordSecurityEvent({
              type: 'OUT_OF_TURN_ACTION',
              severity: 'MEDIUM',
              userId: user.id,
              username: user.username,
              context: { actionId: action?.actionId, matchId: action?.matchId },
            });
            anomalyService.recordImpossibleAction(user.id, 'NOT_YOUR_TURN', err.message, user.username);
          } else if (err.code === 'INVALID_MOVE' || err.code === 'INVALID_TARGET') {
            securityService.recordSecurityEvent({
              type: 'INVALID_GAME_ACTION',
              severity: 'LOW',
              userId: user.id,
              username: user.username,
              context: { actionId: action?.actionId, reason: err.message, code: err.code },
            });
            anomalyService.recordInvalidAction(user.id, err.code, err.message, user.username);
          } else if (err.code === 'DUPLICATE_ACTION') {
            securityService.recordSecurityEvent({
              type: 'DUPLICATE_ACTION',
              severity: 'LOW',
              userId: user.id,
              username: user.username,
              context: { actionId: action?.actionId },
            });
          } else {
            securityService.recordSecurityEvent({
              type: 'INVALID_ACTION',
              severity: 'LOW',
              userId: user.id,
              username: user.username,
              context: { error: err.message },
            });
          }

          socket.emit(GAME_EVENTS.ACTION_REJECTED, {
            actionId: action?.actionId,
            reason: err.message,
            code: err.code || 'INVALID_MOVE',
          });
        }
      });
    } else {
      logger.info('player socket connected', `[id: ${socket.id}]`);
    }

    socket.on('disconnect', (reason) => {
      metricsService.decrementWebsocket();
      logger.info('player socket disconnected', `[id: ${socket.id}, reason: ${reason}]`);

      if (user) {
        eventsService.recordEvent({
          type: 'USER_DISCONNECTED',
          userId: user.id,
          username: user.username,
          metadata: { reason },
        });

        // Disconnect from matchmaking queue if queued
        matchmakingService.handleDisconnect(user.id, socket.id);

        // Update match session socket if in match
        matchSessionService.handlePlayerDisconnect(socket.id);

        const { isLastConnection } = presenceService.removeConnection(socket.id);
        if (isLastConnection) {
          lobbyService.broadcastPresence(user.id, user.username, 'OFFLINE');
        }
      }
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO server has not been initialized');
  }
  return io;
}

/**
 * Closes the Socket.IO server, stops metrics broadcasting intervals, and disconnects clients.
 */
export async function closeSocketServer(): Promise<void> {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }

  if (io) {
    return new Promise<void>((resolve) => {
      io!.close(() => {
        logger.info('Socket.IO server closed cleanly');
        io = null;
        resolve();
      });
    });
  }
}

