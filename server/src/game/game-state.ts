import { FullGameState, GridNode, PlayerGameState, MATCH_STATUS } from '@nexora/shared';

export const GRID_SIZE = 5;

// Strategic special nodes (Center core and cardinal power conduits)
export const SPECIAL_NODE_IDS = new Set<string>(['N22', 'N02', 'N42', 'N20', 'N24']);

export function getNodeCoordinates(nodeId: string): { row: number; col: number } {
  const match = /^N([0-4])([0-4])$/.exec(nodeId);
  if (!match) {
    throw new Error(`Invalid node identifier format: ${nodeId}`);
  }
  return {
    row: parseInt(match[1], 10),
    col: parseInt(match[2], 10),
  };
}

export function formatNodeId(row: number, col: number): string {
  return `N${row}${col}`;
}

/**
 * Creates the authoritative 5x5 CyberGrid (25 nodes).
 */
export function createInitialGrid(): Record<string, GridNode> {
  const grid: Record<string, GridNode> = {};

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const id = formatNodeId(row, col);
      const isSpecial = SPECIAL_NODE_IDS.has(id);

      grid[id] = {
        id,
        row,
        col,
        owner: 'NEUTRAL',
        type: isSpecial ? 'SPECIAL' : 'NORMAL',
        value: isSpecial ? 200 : 100,
        isDefended: false,
        defendedBy: null,
      };
    }
  }

  // Assign player starting nodes
  grid['N00'].owner = 'PLAYER_1';
  grid['N44'].owner = 'PLAYER_2';

  return grid;
}

/**
 * Creates deterministic initial game state for a new match session.
 */
export function createInitialGameState(
  matchId: string,
  player1: { id: string; displayName: string; rating: number },
  player2: { id: string; displayName: string; rating: number }
): FullGameState {
  const grid = createInitialGrid();

  const players: Record<string, PlayerGameState> = {
    [player1.id]: {
      id: player1.id,
      displayName: player1.displayName,
      role: 'PLAYER_1',
      rating: player1.rating,
      score: 0,
      position: 'N00',
      status: 'ACTIVE',
    },
    [player2.id]: {
      id: player2.id,
      displayName: player2.displayName,
      role: 'PLAYER_2',
      rating: player2.rating,
      score: 0,
      position: 'N44',
      status: 'ACTIVE',
    },
  };

  const now = Date.now();

  return {
    matchId,
    version: 1,
    status: MATCH_STATUS.ACTIVE,
    turnPlayerId: player1.id, // Player 1 acts first
    turnNumber: 1,
    grid,
    players,
    winnerId: null,
    createdAt: now,
    updatedAt: now,
  };
}
