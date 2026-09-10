import { getDatabasePool } from '../config/db';
import { CreateUserDTO, UpdateProfileDTO, UserRow } from '../models/user.model';
import { LeaderboardEntry, LeaderboardResponse, PlayerRankResponse } from '@nexora/shared';

export interface IUserRepository {
  create(data: CreateUserDTO): Promise<UserRow>;
  findByEmail(email: string): Promise<UserRow | null>;
  findByUsername(username: string): Promise<UserRow | null>;
  findById(id: string): Promise<UserRow | null>;
  findByIds(ids: string[]): Promise<UserRow[]>;
  updateProfile(userId: string, data: UpdateProfileDTO): Promise<UserRow>;
  recordWin(userId: string, ratingDelta?: number): Promise<void>;
  recordLoss(userId: string, ratingDelta?: number): Promise<void>;
  updateRating(userId: string, newRating: number): Promise<void>;
  updateCompetitiveStats(
    userId: string,
    data: {
      newRating: number;
      isWinner: boolean;
      isDraw?: boolean;
      score: number;
    }
  ): Promise<UserRow>;
  findLeaderboard(page?: number, limit?: number): Promise<LeaderboardResponse>;
  findUserRank(userId: string): Promise<PlayerRankResponse | null>;
  setRole(userId: string, role: string): Promise<UserRow>;
}

export class PostgresUserRepository implements IUserRepository {
  private baseSelect = `
    id, username, email, password_hash, display_name, avatar, role,
    rating, wins, losses, matches_played, total_score, best_score,
    current_win_streak, best_win_streak, created_at, updated_at
  `;

  async create(data: CreateUserDTO): Promise<UserRow> {
    const pool = getDatabasePool();
    const displayName = data.displayName || data.username;
    const avatar = data.avatar || 'default_operative';
    const role = data.role || 'PLAYER';

    const query = `
      INSERT INTO users (
        id, username, email, password_hash, display_name, avatar, role,
        rating, wins, losses, matches_played, total_score, best_score,
        current_win_streak, best_win_streak, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1000, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW())
      RETURNING ${this.baseSelect}
    `;
    const values = [data.id, data.username, data.email, data.passwordHash, displayName, avatar, role];

    try {
      const result = await pool.query<UserRow>(query, values);
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique violation in Postgres
        if (error.detail?.includes('username') || error.message?.includes('username')) {
          const conflictError: any = new Error('Username is already taken');
          conflictError.statusCode = 409;
          throw conflictError;
        }
        if (error.detail?.includes('email') || error.message?.includes('email')) {
          const conflictError: any = new Error('Email is already registered');
          conflictError.statusCode = 409;
          throw conflictError;
        }
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT ${this.baseSelect}
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `;
    const result = await pool.query<UserRow>(query, [email]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findByUsername(username: string): Promise<UserRow | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT ${this.baseSelect}
      FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
    `;
    const result = await pool.query<UserRow>(query, [username]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT ${this.baseSelect}
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query<UserRow>(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findByIds(ids: string[]): Promise<UserRow[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const pool = getDatabasePool();
    const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');
    const query = `
      SELECT ${this.baseSelect}
      FROM users
      WHERE id IN (${placeholders})
    `;
    const result = await pool.query<UserRow>(query, ids);
    return result.rows;
  }

  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<UserRow> {
    const pool = getDatabasePool();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.displayName !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(data.displayName.trim());
    }

    if (data.avatar !== undefined) {
      fields.push(`avatar = $${idx++}`);
      values.push(data.avatar.trim());
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING ${this.baseSelect}
    `;

    const result = await pool.query<UserRow>(query, values);
    if (result.rows.length === 0) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return result.rows[0];
  }

  // Trusted server-authoritative methods for future game stages
  async recordWin(userId: string, ratingDelta = 25): Promise<void> {
    const pool = getDatabasePool();
    const query = `
      UPDATE users
      SET wins = wins + 1,
          matches_played = matches_played + 1,
          rating = rating + $1,
          updated_at = NOW()
      WHERE id = $2
    `;
    await pool.query(query, [ratingDelta, userId]);
  }

  async recordLoss(userId: string, ratingDelta = 20): Promise<void> {
    const pool = getDatabasePool();
    const query = `
      UPDATE users
      SET losses = losses + 1,
          matches_played = matches_played + 1,
          rating = GREATEST(100, rating - $1),
          updated_at = NOW()
      WHERE id = $2
    `;
    await pool.query(query, [ratingDelta, userId]);
  }

  async updateRating(userId: string, newRating: number): Promise<void> {
    const pool = getDatabasePool();
    const query = `
      UPDATE users
      SET rating = $1,
          updated_at = NOW()
      WHERE id = $2
    `;
    await pool.query(query, [newRating, userId]);
  }

  async updateCompetitiveStats(
    userId: string,
    data: {
      newRating: number;
      isWinner: boolean;
      isDraw?: boolean;
      score: number;
    }
  ): Promise<UserRow> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const currentWins = Number(user.wins || 0);
    const currentLosses = Number(user.losses || 0);
    const currentMatches = Number(user.matches_played || 0);
    const currentTotalScore = Number(user.total_score || 0);
    const currentBestScore = Number(user.best_score || 0);
    const currentWinStreak = Number(user.current_win_streak || 0);
    const currentBestWinStreak = Number(user.best_win_streak || 0);

    const newWins = data.isWinner ? currentWins + 1 : currentWins;
    const newLosses = !data.isWinner && !data.isDraw ? currentLosses + 1 : currentLosses;
    const newMatches = currentMatches + 1;
    const newTotalScore = currentTotalScore + Math.max(0, data.score);
    const newBestScore = Math.max(currentBestScore, data.score);
    const newWinStreak = data.isWinner ? currentWinStreak + 1 : 0;
    const newBestWinStreak = Math.max(currentBestWinStreak, newWinStreak);
    const newRating = Math.max(100, Math.round(data.newRating));

    const pool = getDatabasePool();
    const query = `
      UPDATE users
      SET rating = $1,
          wins = $2,
          losses = $3,
          matches_played = $4,
          total_score = $5,
          best_score = $6,
          current_win_streak = $7,
          best_win_streak = $8,
          updated_at = NOW()
      WHERE id = $9
      RETURNING ${this.baseSelect}
    `;

    const result = await pool.query<UserRow>(query, [
      newRating,
      newWins,
      newLosses,
      newMatches,
      newTotalScore,
      newBestScore,
      newWinStreak,
      newBestWinStreak,
      userId,
    ]);

    return result.rows[0];
  }

  async findLeaderboard(page: number = 1, limit: number = 20): Promise<LeaderboardResponse> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const countRes = await pool.query<{ total: string | number }>('SELECT COUNT(*) as total FROM users');
    const total = Number(countRes.rows[0]?.total || 0);

    const query = `
      SELECT
        id, username, display_name, avatar, rating, wins, losses, matches_played,
        total_score, best_score, current_win_streak, best_win_streak
      FROM users
      ORDER BY rating DESC, wins DESC, created_at ASC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query<UserRow>(query, [safeLimit, offset]);

    const entries: LeaderboardEntry[] = result.rows.map((row, idx) => {
      const matchesPlayed = Number(row.matches_played || 0);
      const wins = Number(row.wins || 0);
      const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0;

      return {
        rank: offset + idx + 1,
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        avatar: row.avatar || 'default_operative',
        rating: Number(row.rating || 1000),
        wins,
        losses: Number(row.losses || 0),
        matchesPlayed,
        winRate,
        currentWinStreak: Number(row.current_win_streak || 0),
        bestWinStreak: Number(row.best_win_streak || 0),
        totalScore: Number(row.total_score || 0),
        bestScore: Number(row.best_score || 0),
      };
    });

    return {
      entries,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async findUserRank(userId: string): Promise<PlayerRankResponse | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    const pool = getDatabasePool();
    const countQuery = `
      SELECT COUNT(*) as higher_count
      FROM users
      WHERE rating > $1
         OR (rating = $1 AND wins > $2)
         OR (rating = $1 AND wins = $2 AND created_at < $3)
    `;
    const countRes = await pool.query<{ higher_count: string | number }>(countQuery, [
      user.rating || 1000,
      user.wins || 0,
      user.created_at,
    ]);

    const rank = Number(countRes.rows[0]?.higher_count || 0) + 1;
    const matchesPlayed = Number(user.matches_played || 0);
    const wins = Number(user.wins || 0);
    const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0;

    return {
      rank,
      rating: Number(user.rating || 1000),
      wins,
      losses: Number(user.losses || 0),
      matchesPlayed,
      winRate,
      currentWinStreak: Number(user.current_win_streak || 0),
      bestWinStreak: Number(user.best_win_streak || 0),
      totalScore: Number(user.total_score || 0),
      bestScore: Number(user.best_score || 0),
    };
  }

  async setRole(userId: string, role: string): Promise<UserRow> {
    const pool = getDatabasePool();
    const query = `
      UPDATE users
      SET role = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.baseSelect}
    `;
    const result = await pool.query<UserRow>(query, [role, userId]);
    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }
    return result.rows[0];
  }
}

export const userRepository = new PostgresUserRepository();
