import { randomUUID } from 'crypto';
import {
  MatchStatus,
  MATCH_STATUS,
  MatchResultDetails,
  MatchResultPlayer,
  MatchHistoryItem,
  MatchHistoryResponse,
} from '@nexora/shared';
import { getDatabasePool } from '../config/db';
import { MatchRow, MatchPlayerRow } from '../models/match.model';

export interface FinalizePlayerParams {
  userId: string;
  score: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
}

export interface FinalizeMatchParams {
  matchId: string;
  winnerId: string | null;
  endedAt: Date;
  durationSeconds: number;
  finalVersion: number;
  players: FinalizePlayerParams[];
}

export interface IMatchRepository {
  createMatch(status?: MatchStatus): Promise<MatchRow>;
  addPlayerToMatch(matchId: string, userId: string): Promise<MatchPlayerRow>;
  findMatchById(id: string): Promise<MatchRow | null>;
  findPlayersByMatchId(matchId: string): Promise<MatchPlayerRow[]>;
  updateMatchStatus(
    id: string,
    status: MatchStatus,
    endedAt?: Date,
    winnerId?: string
  ): Promise<MatchRow>;
  findActiveMatchByUserId(userId: string): Promise<MatchRow | null>;
  finalizeMatch(params: FinalizeMatchParams): Promise<MatchRow>;
  findMatchResultById(matchId: string): Promise<MatchResultDetails | null>;
  findMatchHistoryByUserId(userId: string, page?: number, limit?: number): Promise<MatchHistoryResponse>;
}

export class PostgresMatchRepository implements IMatchRepository {
  private baseMatchSelect = 'id, status, created_at, started_at, ended_at, winner_id, duration_seconds, final_version';
  private basePlayerSelect = 'id, match_id, user_id, score, status, joined_at, rating_before, rating_after, rating_change';

  async createMatch(status: MatchStatus = MATCH_STATUS.ACTIVE): Promise<MatchRow> {
    const pool = getDatabasePool();
    const id = randomUUID();
    const query = `
      INSERT INTO matches (id, status, created_at, started_at, duration_seconds, final_version)
      VALUES ($1, $2, NOW(), NOW(), 0, 1)
      RETURNING ${this.baseMatchSelect}
    `;
    const result = await pool.query<MatchRow>(query, [id, status]);
    return result.rows[0];
  }

  async addPlayerToMatch(matchId: string, userId: string): Promise<MatchPlayerRow> {
    const pool = getDatabasePool();
    const id = randomUUID();
    const query = `
      INSERT INTO match_players (id, match_id, user_id, score, status, joined_at, rating_before, rating_after, rating_change)
      VALUES ($1, $2, $3, 0, 'ACTIVE', NOW(), 1000, 1000, 0)
      RETURNING ${this.basePlayerSelect}
    `;
    const result = await pool.query<MatchPlayerRow>(query, [id, matchId, userId]);
    return result.rows[0];
  }

  async findMatchById(id: string): Promise<MatchRow | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT ${this.baseMatchSelect}
      FROM matches
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query<MatchRow>(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findPlayersByMatchId(matchId: string): Promise<MatchPlayerRow[]> {
    const pool = getDatabasePool();
    const query = `
      SELECT ${this.basePlayerSelect}
      FROM match_players
      WHERE match_id = $1
      ORDER BY joined_at ASC
    `;
    const result = await pool.query<MatchPlayerRow>(query, [matchId]);
    return result.rows;
  }

  async updateMatchStatus(
    id: string,
    status: MatchStatus,
    endedAt?: Date,
    winnerId?: string
  ): Promise<MatchRow> {
    const pool = getDatabasePool();
    const query = `
      UPDATE matches
      SET status = $1,
          ended_at = $2,
          winner_id = $3
      WHERE id = $4
      RETURNING ${this.baseMatchSelect}
    `;
    const result = await pool.query<MatchRow>(query, [
      status,
      endedAt || null,
      winnerId || null,
      id,
    ]);

    if (result.rows.length === 0) {
      throw new Error(`Match ${id} not found`);
    }

    return result.rows[0];
  }

  async findActiveMatchByUserId(userId: string): Promise<MatchRow | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT m.id, m.status, m.created_at, m.started_at, m.ended_at, m.winner_id, m.duration_seconds, m.final_version
      FROM matches m
      INNER JOIN match_players mp ON m.id = mp.match_id
      WHERE mp.user_id = $1
        AND m.status IN ('PENDING', 'ACTIVE')
      ORDER BY m.created_at DESC
      LIMIT 1
    `;
    const result = await pool.query<MatchRow>(query, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async finalizeMatch(params: FinalizeMatchParams): Promise<MatchRow> {
    const pool = getDatabasePool();
    const updateMatchQuery = `
      UPDATE matches
      SET status = $1,
          ended_at = $2,
          winner_id = $3,
          duration_seconds = $4,
          final_version = $5
      WHERE id = $6
      RETURNING ${this.baseMatchSelect}
    `;
    const matchRes = await pool.query<MatchRow>(updateMatchQuery, [
      MATCH_STATUS.COMPLETED,
      params.endedAt,
      params.winnerId || null,
      params.durationSeconds,
      params.finalVersion,
      params.matchId,
    ]);

    if (matchRes.rows.length === 0) {
      throw new Error(`Match ${params.matchId} not found`);
    }

    for (const player of params.players) {
      const updatePlayerQuery = `
        UPDATE match_players
        SET score = $1,
            rating_before = $2,
            rating_after = $3,
            rating_change = $4,
            status = 'COMPLETED'
        WHERE match_id = $5 AND user_id = $6
      `;
      await pool.query(updatePlayerQuery, [
        player.score,
        player.ratingBefore,
        player.ratingAfter,
        player.ratingChange,
        params.matchId,
        player.userId,
      ]);
    }

    return matchRes.rows[0];
  }

  async findMatchResultById(matchId: string): Promise<MatchResultDetails | null> {
    const pool = getDatabasePool();
    const matchQuery = `
      SELECT ${this.baseMatchSelect}
      FROM matches
      WHERE id = $1
      LIMIT 1
    `;
    const matchRes = await pool.query<MatchRow>(matchQuery, [matchId]);
    if (matchRes.rows.length === 0) {
      return null;
    }
    const match = matchRes.rows[0];

    const playersQuery = `
      SELECT
        mp.user_id,
        mp.score,
        mp.rating_before,
        mp.rating_after,
        mp.rating_change,
        u.username,
        u.display_name,
        u.avatar
      FROM match_players mp
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE mp.match_id = $1
      ORDER BY mp.score DESC, mp.joined_at ASC
    `;
    const playersRes = await pool.query<any>(playersQuery, [matchId]);

    const players: MatchResultPlayer[] = playersRes.rows.map((p) => {
      const isWinner = match.winner_id ? match.winner_id === p.user_id : false;
      return {
        userId: p.user_id,
        username: p.username || 'Unknown Operative',
        displayName: p.display_name || p.username || 'Unknown Operative',
        avatar: p.avatar || 'default_operative',
        score: Number(p.score || 0),
        ratingBefore: Number(p.rating_before || 1000),
        ratingAfter: Number(p.rating_after || 1000),
        ratingChange: Number(p.rating_change || 0),
        isWinner,
      };
    });

    const winner = players.find((p) => p.isWinner) || null;

    return {
      matchId: match.id,
      status: match.status,
      winnerId: match.winner_id,
      winner,
      durationSeconds: Number(match.duration_seconds || 0),
      startedAt: match.started_at ? new Date(match.started_at).toISOString() : new Date().toISOString(),
      endedAt: match.ended_at ? new Date(match.ended_at).toISOString() : null,
      finalVersion: Number(match.final_version || 1),
      players,
    };
  }

  async findMatchHistoryByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<MatchHistoryResponse> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    // Count user's completed matches
    const countQuery = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM matches m
      INNER JOIN match_players mp ON m.id = mp.match_id
      WHERE mp.user_id = $1 AND m.status = 'COMPLETED'
    `;
    const countRes = await pool.query<{ total: string | number }>(countQuery, [userId]);
    const total = Number(countRes.rows[0]?.total || 0);

    if (total === 0) {
      return {
        matches: [],
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1,
      };
    }

    // Get paginated matches for this user
    const matchesQuery = `
      SELECT m.id, m.status, m.created_at, m.started_at, m.ended_at, m.winner_id, m.duration_seconds, m.final_version
      FROM matches m
      INNER JOIN match_players mp ON m.id = mp.match_id
      WHERE mp.user_id = $1 AND m.status = 'COMPLETED'
      ORDER BY m.ended_at DESC, m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const matchesRes = await pool.query<MatchRow>(matchesQuery, [userId, safeLimit, offset]);

    if (matchesRes.rows.length === 0) {
      return {
        matches: [],
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      };
    }

    const matchIds = matchesRes.rows.map((m) => m.id);
    const placeholders = matchIds.map((_, idx) => `$${idx + 1}`).join(', ');

    // Fetch all players for these matches to resolve user & opponent
    const playersQuery = `
      SELECT
        mp.match_id,
        mp.user_id,
        mp.score,
        mp.rating_before,
        mp.rating_after,
        mp.rating_change,
        u.username,
        u.display_name,
        u.avatar,
        u.rating
      FROM match_players mp
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE mp.match_id IN (${placeholders})
    `;
    const playersRes = await pool.query<any>(playersQuery, matchIds);

    // Group players by match_id
    const playersByMatch = new Map<string, any[]>();
    for (const p of playersRes.rows) {
      if (!playersByMatch.has(p.match_id)) {
        playersByMatch.set(p.match_id, []);
      }
      playersByMatch.get(p.match_id)!.push(p);
    }

    const matches: MatchHistoryItem[] = matchesRes.rows.map((m) => {
      const matchPlayers = playersByMatch.get(m.id) || [];
      const userPlayer = matchPlayers.find((p) => p.user_id === userId);
      const oppPlayer = matchPlayers.find((p) => p.user_id !== userId);

      let result: 'VICTORY' | 'DEFEAT' | 'DRAW' = 'DRAW';
      if (m.winner_id) {
        result = m.winner_id === userId ? 'VICTORY' : 'DEFEAT';
      }

      return {
        matchId: m.id,
        result,
        myScore: Number(userPlayer?.score || 0),
        opponentScore: Number(oppPlayer?.score || 0),
        ratingBefore: Number(userPlayer?.rating_before ?? 1000),
        ratingAfter: Number(userPlayer?.rating_after ?? userPlayer?.rating ?? 1000),
        ratingChange: Number(userPlayer?.rating_change || 0),
        opponent: {
          id: oppPlayer?.user_id || 'unknown',
          username: oppPlayer?.username || 'Opponent',
          displayName: oppPlayer?.display_name || oppPlayer?.username || 'Opponent Operative',
          avatar: oppPlayer?.avatar || 'default_operative',
          rating: Number(oppPlayer?.rating_after ?? oppPlayer?.rating ?? 1000),
        },
        durationSeconds: Number(m.duration_seconds || 0),
        completedAt: m.ended_at
          ? new Date(m.ended_at).toISOString()
          : (m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString()),
      };
    });

    return {
      matches,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }
}

export const matchRepository = new PostgresMatchRepository();

