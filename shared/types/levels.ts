export interface LevelTemplate {
  id: string;
  name: string;
  gridSize: number; // For N x N grids
  specialNodes: string[]; // e.g. ["N22", "N02", "N42", "N20", "N24"]
  startingPositions: string[]; // e.g. ["N00", "N44", "N40", "N04"]
  maxPlayers: number;
}

export type GameMode = '1v1' | '4P' | 'FFA';

export const LEVELS: Record<string, LevelTemplate> = {
  LEVEL_1v1_SMALL: {
    id: 'LEVEL_1v1_SMALL',
    name: 'Duel Arena (5x5)',
    gridSize: 5,
    specialNodes: ['N22', 'N02', 'N42', 'N20', 'N24'],
    startingPositions: ['N00', 'N44'],
    maxPlayers: 2,
  },
  LEVEL_4P_MEDIUM: {
    id: 'LEVEL_4P_MEDIUM',
    name: 'Skirmish (7x7)',
    gridSize: 7,
    specialNodes: ['N33', 'N11', 'N55', 'N15', 'N51'],
    startingPositions: ['N00', 'N66', 'N60', 'N06'],
    maxPlayers: 4,
  },
  LEVEL_FFA_LARGE: {
    id: 'LEVEL_FFA_LARGE',
    name: 'Warzone (10x10)',
    gridSize: 10,
    specialNodes: ['N44', 'N55', 'N45', 'N54', 'N22', 'N77', 'N27', 'N72'],
    startingPositions: ['N00', 'N99', 'N90', 'N09', 'N04', 'N94', 'N40', 'N49', 'N05', 'N95'],
    maxPlayers: 10,
  }
};
