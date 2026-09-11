import {
  FullGameState,
  GameActionPayload,
  MATCH_STATUS,
  GameEventRecord,
  LevelTemplate,
} from '@nexora/shared';
import { createInitialGameState } from './game-state';
import { executeAction, ActionResult } from './game-actions';
import { GameRuleError } from './game-rules';
import { gameRepository } from '../repositories/game.repository';
import { matchRepository } from '../repositories/match.repository';
import { logger } from '../utils/logger';

export const WINNING_SCORE_THRESHOLD = 1500;
export const ACTION_COOLDOWN_MS = 250;

export interface ProcessActionResult {
  success: boolean;
  state: FullGameState;
  actionResult: ActionResult;
  eventRecord: GameEventRecord;
  isGameOver: boolean;
  winnerId?: string | null;
}

export class GameEngine {
  // matchId -> FullGameState
  private matches = new Map<string, FullGameState>();

  // matchId -> Set<actionId>
  private processedActions = new Map<string, Set<string>>();

  // key: `${matchId}:${playerId}` -> lastActionTimestamp
  private playerLastAction = new Map<string, number>();

  /**
   * Initializes authoritative game state for a matched session.
   */
  initGame(
    matchId: string,
    level: LevelTemplate,
    players: { id: string; displayName: string; rating: number }[]
  ): FullGameState {
    const existing = this.matches.get(matchId);
    if (existing) {
      return existing;
    }

    const state = createInitialGameState(matchId, level, players);
    this.matches.set(matchId, state);
    this.processedActions.set(matchId, new Set<string>());

    logger.info(`GameEngine: Initialized match ${matchId} (Turn: ${players[0].displayName})`);

    // Async persist initial state
    gameRepository.saveGameState(matchId, state.version, state).catch(() => {});
    return state;
  }

  getGameState(matchId: string): FullGameState | null {
    return this.matches.get(matchId) || null;
  }

  /**
   * Server-authoritative action resolution.
   */
  processAction(
    matchId: string,
    playerId: string,
    action: GameActionPayload
  ): ProcessActionResult {
    const state = this.matches.get(matchId);
    if (!state) {
      throw new GameRuleError('GAME_NOT_ACTIVE', 'Game session does not exist or has expired');
    }

    if (!action.actionId) {
      throw new GameRuleError('INVALID_MOVE', 'Missing unique actionId identifier');
    }

    // 1. Idempotency Check: Reject duplicate action processing
    let actionSet = this.processedActions.get(matchId);
    if (!actionSet) {
      actionSet = new Set<string>();
      this.processedActions.set(matchId, actionSet);
    }

    if (actionSet.has(action.actionId)) {
      throw new GameRuleError('DUPLICATE_ACTION', 'Action already processed (idempotency triggered)');
    }

    // 2. Rate Limiting Check: 250ms minimum cooldown per player
    const rateLimitKey = `${matchId}:${playerId}`;
    const now = Date.now();
    const lastAction = this.playerLastAction.get(rateLimitKey) || 0;

    if (now - lastAction < ACTION_COOLDOWN_MS) {
      throw new GameRuleError('RATE_LIMITED', 'Action rate limit exceeded. Please wait a moment.');
    }

    // 3. Execute authoritative game action
    const actionResult = executeAction(state, playerId, action.type, action.targetNodeId);

    // Record actionId and timestamp
    actionSet.add(action.actionId);
    this.playerLastAction.set(rateLimitKey, now);

    // 4. Increment state version and turn
    state.version++;
    state.turnNumber++;
    state.updatedAt = now;

    // Switch turn to other player sequentially
    const playerIds = Object.keys(state.players);
    const currentPlayerIndex = playerIds.indexOf(playerId);
    const nextPlayerId = playerIds[(currentPlayerIndex + 1) % playerIds.length];
    state.turnPlayerId = nextPlayerId;

    // Clear expired defense for the upcoming turn player
    for (const node of Object.values(state.grid)) {
      if (node.isDefended && node.defendedBy === nextPlayerId) {
        node.isDefended = false;
        node.defendedBy = null;
      }
    }

    // 5. Check Win Condition
    let isGameOver = false;
    let winnerId: string | null = null;

    const actingPlayer = state.players[playerId];
    if (actingPlayer.score >= WINNING_SCORE_THRESHOLD) {
      isGameOver = true;
      winnerId = playerId;
    } else {
      // Check if all neutral nodes have been claimed
      const remainingNeutral = Object.values(state.grid).some((n) => n.owner === 'NEUTRAL');
      if (!remainingNeutral) {
        isGameOver = true;
        let bestPlayer = Object.values(state.players)[0];
        for (const p of Object.values(state.players)) {
          if (p.score > bestPlayer.score) {
            bestPlayer = p;
          }
        }
        winnerId = bestPlayer.id;
      }
    }

    if (isGameOver && winnerId) {
      state.status = MATCH_STATUS.COMPLETED;
      state.winnerId = winnerId;
      logger.info(`GameEngine: Match ${matchId} COMPLETED. Winner: ${state.players[winnerId]?.displayName}`);
    }

    const eventRecord: GameEventRecord = {
      id: action.actionId,
      matchId,
      playerId,
      type: actionResult.eventType,
      message: actionResult.message,
      timestamp: now,
    };

    // Async persist snapshot & event log
    gameRepository.saveGameState(matchId, state.version, state).catch(() => {});
    gameRepository.recordMatchEvent(matchId, playerId, actionResult.eventType, {
      actionId: action.actionId,
      scoreDelta: actionResult.scoreDelta,
      targetNodeId: actionResult.targetNodeId,
      message: actionResult.message,
    }).catch(() => {});

    return {
      success: true,
      state,
      actionResult,
      eventRecord,
      isGameOver,
      winnerId,
    };
  }

  endGame(matchId: string): void {
    this.matches.delete(matchId);
    this.processedActions.delete(matchId);
  }
}

export const gameEngine = new GameEngine();
