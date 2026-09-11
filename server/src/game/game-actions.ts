import { FullGameState, GameActionType } from '@nexora/shared';
import {
  validateTurn,
  validateMove,
  validateCapture,
  validateAttack,
  validateDefend,
} from './game-rules';

export interface ActionResult {
  success: boolean;
  type: GameActionType;
  eventType: string;
  message: string;
  scoreDelta: number;
  targetNodeId?: string;
}

export function executeAction(
  state: FullGameState,
  playerId: string,
  type: GameActionType,
  targetNodeId?: string
): ActionResult {
  // 1. Validate turn & active status
  validateTurn(state, playerId);

  const player = state.players[playerId];

  switch (type) {
    case 'MOVE': {
      // Validate move
      const targetNode = validateMove(state, playerId, targetNodeId);

      // If moving onto a NEUTRAL node, automatically resolve as CAPTURE
      if (targetNode.owner === 'NEUTRAL') {
        return executeCaptureInternal(state, player, targetNode);
      }

      // Repositioning to an already owned node
      player.position = targetNode.id;
      return {
        success: true,
        type: 'MOVE',
        eventType: 'PLAYER_MOVE',
        message: `${player.displayName} moved to controlled node ${targetNode.id}`,
        scoreDelta: 0,
        targetNodeId: targetNode.id,
      };
    }

    case 'CAPTURE': {
      const targetNode = validateCapture(state, playerId, targetNodeId);
      return executeCaptureInternal(state, player, targetNode);
    }

    case 'ATTACK': {
      const targetNode = validateAttack(state, playerId, targetNodeId);

      if (targetNode.isDefended) {
        // Defensive firewall absorbs attack
        targetNode.isDefended = false;
        targetNode.defendedBy = null;
        player.score += 25; // Breach reward

        return {
          success: true,
          type: 'ATTACK',
          eventType: 'PLAYER_ATTACKED',
          message: `${player.displayName} breached defensive firewall at ${targetNode.id} (+25 PTS)`,
          scoreDelta: 25,
          targetNodeId: targetNode.id,
        };
      }

      // Attack succeeds: node captured from enemy
      targetNode.owner = player.id;
      player.score += 50;

      return {
        success: true,
        type: 'ATTACK',
        eventType: 'PLAYER_ATTACKED',
        message: `${player.displayName} attacked and seized enemy node ${targetNode.id} (+50 PTS)`,
        scoreDelta: 50,
        targetNodeId: targetNode.id,
      };
    }

    case 'DEFEND': {
      const currentNode = validateDefend(state, playerId);
      currentNode.isDefended = true;
      currentNode.defendedBy = playerId;

      return {
        success: true,
        type: 'DEFEND',
        eventType: 'PLAYER_DEFENDED',
        message: `${player.displayName} raised defensive firewall on node ${currentNode.id}`,
        scoreDelta: 0,
        targetNodeId: currentNode.id,
      };
    }

    default:
      throw new Error(`Unsupported action type: ${type}`);
  }
}

function executeCaptureInternal(state: FullGameState, player: any, targetNode: any): ActionResult {
  const points = targetNode.value; // 100 or 200
  targetNode.owner = player.id;
  player.position = targetNode.id;
  player.score += points;

  const isSpecial = targetNode.type === 'SPECIAL';

  return {
    success: true,
    type: 'CAPTURE',
    eventType: 'NODE_CAPTURED',
    message: `${player.displayName} captured ${isSpecial ? 'CORE NODE' : 'node'} ${targetNode.id} (+${points} PTS)`,
    scoreDelta: points,
    targetNodeId: targetNode.id,
  };
}
