import { FullGameState, GridNode, PlayerGameState, MATCH_STATUS, LevelTemplate } from '@nexora/shared';

export function getNodeCoordinates(nodeId: string): { row: number; col: number } {
  const match = /^N(\d+)(\d+)$/.exec(nodeId);
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

export function createInitialGrid(level: LevelTemplate, players: string[]): Record<string, GridNode> {
  const grid: Record<string, GridNode> = {};
  
  // Find valid nodes for special nodes (excluding starting positions)
  const availableNodes: string[] = [];
  for (let row = 0; row < level.gridSize; row++) {
    for (let col = 0; col < level.gridSize; col++) {
      const id = formatNodeId(row, col);
      if (!level.startingPositions.includes(id)) {
        availableNodes.push(id);
      }
    }
  }

  // Shuffle availableNodes
  for (let i = availableNodes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableNodes[i], availableNodes[j]] = [availableNodes[j], availableNodes[i]];
  }

  // Pick the requested number of special nodes
  const specialNodes = new Set(availableNodes.slice(0, level.numSpecialNodes));

  for (let row = 0; row < level.gridSize; row++) {
    for (let col = 0; col < level.gridSize; col++) {
      const id = formatNodeId(row, col);
      const isSpecial = specialNodes.has(id);

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
  players.forEach((playerId, index) => {
    const startNode = level.startingPositions[index % level.startingPositions.length];
    if (grid[startNode]) {
      grid[startNode].owner = playerId;
    }
  });

  return grid;
}

/**
 * Creates deterministic initial game state for a new match session.
 */
export function createInitialGameState(
  matchId: string,
  level: LevelTemplate,
  playerInfos: { id: string; displayName: string; rating: number }[]
): FullGameState {
  const playerIds = playerInfos.map(p => p.id);
  const grid = createInitialGrid(level, playerIds);

  const players: Record<string, PlayerGameState> = {};
  
  playerInfos.forEach((p, i) => {
    const startNode = level.startingPositions[i % level.startingPositions.length];
    players[p.id] = {
      id: p.id,
      displayName: p.displayName,
      role: `PLAYER_${i + 1}`,
      rating: p.rating,
      score: 0,
      position: startNode,
      status: 'ACTIVE',
    };
  });

  const now = Date.now();

  return {
    matchId,
    version: 1,
    status: MATCH_STATUS.ACTIVE,
    turnPlayerId: playerInfos[0].id, // Player 1 acts first
    turnNumber: 1,
    grid,
    players,
    winnerId: null,
    createdAt: now,
    updatedAt: now,
  };
}

