export interface LevelTemplate {
  id: string;
  name: string;
  gridSize: number; // For N x N grids
  numSpecialNodes: number; // Number of max point nodes to randomly spawn
  startingPositions: string[]; // e.g. ["N00", "N44", "N40", "N04"]
  maxPlayers: number;
}

export type GameMode = '1v1' | '4P' | 'FFA';

export const LEVELS: Record<string, LevelTemplate> = {
  LEVEL_1v1_SMALL: {
    id: 'LEVEL_1v1_SMALL',
    name: 'Level 1: Duel Arena (5x5)',
    gridSize: 5,
    numSpecialNodes: 5,
    startingPositions: ['N00', 'N44'],
    maxPlayers: 2,
  },
  LEVEL_4P_MEDIUM: {
    id: 'LEVEL_4P_MEDIUM',
    name: 'Level 2: Skirmish (7x7)',
    gridSize: 7,
    numSpecialNodes: 5,
    startingPositions: ['N00', 'N66', 'N60', 'N06'],
    maxPlayers: 4,
  },
  LEVEL_FFA_LARGE: {
    id: 'LEVEL_FFA_LARGE',
    name: 'Level 3: Warzone (10x10)',
    gridSize: 10,
    numSpecialNodes: 8,
    startingPositions: ['N00', 'N99', 'N90', 'N09', 'N04', 'N94', 'N40', 'N49', 'N05', 'N95'],
    maxPlayers: 10,
  }
};
