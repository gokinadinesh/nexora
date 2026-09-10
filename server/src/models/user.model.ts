import { User, PlayerProfile } from '@nexora/shared';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name?: string | null;
  avatar?: string;
  role?: string;
  rating?: number;
  wins?: number;
  losses?: number;
  matches_played?: number;
  total_score?: number;
  best_score?: number;
  current_win_streak?: number;
  best_win_streak?: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateUserDTO {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  avatar?: string;
  role?: string;
}

export interface UpdateProfileDTO {
  displayName?: string;
  avatar?: string;
}

/**
 * Transforms a raw database user row into a safe public User entity.
 * Strictly strips out password_hash.
 */
export function toSafeUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name || row.username,
    avatar: row.avatar || 'default_operative',
    role: (row.role as any) || 'PLAYER',
    rating: row.rating !== undefined ? Number(row.rating) : 1000,
    wins: row.wins !== undefined ? Number(row.wins) : 0,
    losses: row.losses !== undefined ? Number(row.losses) : 0,
    matchesPlayed: row.matches_played !== undefined ? Number(row.matches_played) : 0,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/**
 * Transforms a raw user row into the extended PlayerProfile structure.
 */
export function toPlayerProfile(row: UserRow, status: string = 'ONLINE'): PlayerProfile {
  const matchesPlayed = row.matches_played !== undefined ? Number(row.matches_played) : 0;
  const wins = row.wins !== undefined ? Number(row.wins) : 0;
  const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0;

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name || row.username,
    avatar: row.avatar || 'default_operative',
    role: (row.role as any) || 'PLAYER',
    rating: row.rating !== undefined ? Number(row.rating) : 1000,
    wins,
    losses: row.losses !== undefined ? Number(row.losses) : 0,
    matchesPlayed,
    totalScore: row.total_score !== undefined ? Number(row.total_score) : 0,
    bestScore: row.best_score !== undefined ? Number(row.best_score) : 0,
    currentWinStreak: row.current_win_streak !== undefined ? Number(row.current_win_streak) : 0,
    bestWinStreak: row.best_win_streak !== undefined ? Number(row.best_win_streak) : 0,
    winRate,
    status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
