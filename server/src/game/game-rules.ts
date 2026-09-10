import { FullGameState, GridNode } from '@nexora/shared';
import { getNodeCoordinates } from './game-state';

export class GameRuleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

/**
 * Validates strict Manhattan adjacency (up, down, left, right).
 * Diagonal movement and distant moves are strictly invalid.
 */
export function isAdjacent(nodeAId: string, nodeBId: string): boolean {
  if (nodeAId === nodeBId) return false;

  try {
    const a = getNodeCoordinates(nodeAId);
    const b = getNodeCoordinates(nodeBId);

    const rowDiff = Math.abs(a.row - b.row);
    const colDiff = Math.abs(a.col - b.col);

    return rowDiff + colDiff === 1;
  } catch {
    return false;
  }
}

/**
 * Validates that it is currently the requesting player's turn and match is ACTIVE.
 */
export function validateTurn(state: FullGameState, playerId: string): void {
  if (state.status !== 'ACTIVE') {
    throw new GameRuleError('GAME_NOT_ACTIVE', 'Match is not in an active state');
  }

  if (state.turnPlayerId !== playerId) {
    throw new GameRuleError('NOT_YOUR_TURN', 'Action rejected: It is not your turn');
  }
}

/**
 * Validates MOVE action rules.
 */
export function validateMove(state: FullGameState, playerId: string, targetNodeId?: string): GridNode {
  if (!targetNodeId || !state.grid[targetNodeId]) {
    throw new GameRuleError('INVALID_TARGET', 'Target node does not exist on the CyberGrid');
  }

  const player = state.players[playerId];
  if (!player) {
    throw new GameRuleError('UNAUTHORIZED', 'Player does not belong to this match session');
  }

  if (!isAdjacent(player.position, targetNodeId)) {
    throw new GameRuleError('INVALID_MOVE', 'Movement is only permitted to strictly adjacent nodes (no diagonals)');
  }

  // Check if opponent operative occupies the target node
  const opponent = Object.values(state.players).find((p) => p.id !== playerId);
  if (opponent && opponent.position === targetNodeId) {
    throw new GameRuleError('INVALID_MOVE', 'Cannot move directly onto an occupied enemy operative node. Use ATTACK instead.');
  }

  return state.grid[targetNodeId];
}

/**
 * Validates CAPTURE action rules.
 */
export function validateCapture(state: FullGameState, playerId: string, targetNodeId?: string): GridNode {
  const targetNode = validateMove(state, playerId, targetNodeId);

  if (targetNode.owner !== 'NEUTRAL') {
    throw new GameRuleError('INVALID_TARGET', 'Only NEUTRAL nodes can be captured directly. Use ATTACK for enemy nodes.');
  }

  return targetNode;
}

/**
 * Validates ATTACK action rules.
 */
export function validateAttack(state: FullGameState, playerId: string, targetNodeId?: string): GridNode {
  if (!targetNodeId || !state.grid[targetNodeId]) {
    throw new GameRuleError('INVALID_TARGET', 'Target node does not exist on the CyberGrid');
  }

  const player = state.players[playerId];
  if (!player) {
    throw new GameRuleError('UNAUTHORIZED', 'Player does not belong to this match session');
  }

  if (!isAdjacent(player.position, targetNodeId)) {
    throw new GameRuleError('INVALID_MOVE', 'Attacks can only target adjacent enemy nodes');
  }

  const targetNode = state.grid[targetNodeId];
  if (targetNode.owner === 'NEUTRAL') {
    throw new GameRuleError('INVALID_TARGET', 'Cannot attack a neutral node. Use CAPTURE instead.');
  }

  if (targetNode.owner === player.role) {
    throw new GameRuleError('INVALID_TARGET', 'Cannot attack your own node');
  }

  return targetNode;
}

/**
 * Validates DEFEND action rules.
 */
export function validateDefend(state: FullGameState, playerId: string): GridNode {
  const player = state.players[playerId];
  if (!player) {
    throw new GameRuleError('UNAUTHORIZED', 'Player does not belong to this match session');
  }

  const currentNode = state.grid[player.position];
  if (!currentNode) {
    throw new GameRuleError('INVALID_TARGET', 'Current position is invalid');
  }

  if (currentNode.owner !== player.role) {
    throw new GameRuleError('INVALID_TARGET', 'You can only defend nodes currently owned by your operative');
  }

  return currentNode;
}
