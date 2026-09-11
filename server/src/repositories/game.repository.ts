import { randomUUID } from 'crypto';
import { FullGameState } from '@nexora/shared';
import { getDatabasePool } from '../config/db';
import { logger } from '../utils/logger';

export interface IGameRepository {
  saveGameState(matchId: string, version: number, state: FullGameState): Promise<void>;
  recordMatchEvent(
    matchId: string,
    playerId: string | null,
    eventType: string,
    eventData: any
  ): Promise<void>;
  getLatestGameState(matchId: string): Promise<FullGameState | null>;
  getMatchEvents(matchId: string, limit?: number): Promise<any[]>;
  getAllGameStates(matchId: string): Promise<{ state_version: number; state_json: FullGameState }[]>;
  persistReplay(matchId: string, durationSeconds: number, initialState: FullGameState, eventTimeline: any[], finalState: FullGameState | null): Promise<void>;
  getReplay(matchId: string): Promise<any | null>;
}

export class PostgresGameRepository implements IGameRepository {
  async saveGameState(matchId: string, version: number, state: FullGameState): Promise<void> {
    const pool = getDatabasePool();
    const id = randomUUID();
    const query = `
      INSERT INTO game_states (id, match_id, state_version, state_json, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;

    try {
      await pool.query(query, [id, matchId, version, JSON.stringify(state)]);
    } catch (err) {
      logger.error(`GameRepo: Error saving game state for match ${matchId}:`, err);
    }
  }

  async recordMatchEvent(
    matchId: string,
    playerId: string | null,
    eventType: string,
    eventData: any = {}
  ): Promise<void> {
    const pool = getDatabasePool();
    const id = randomUUID();
    const query = `
      INSERT INTO match_events (id, match_id, player_id, event_type, event_data, timestamp)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;

    try {
      await pool.query(query, [id, matchId, playerId, eventType, JSON.stringify(eventData)]);
    } catch (err) {
      logger.error(`GameRepo: Error recording match event for match ${matchId}:`, err);
    }
  }

  async getLatestGameState(matchId: string): Promise<FullGameState | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT state_json
      FROM game_states
      WHERE match_id = $1
      ORDER BY state_version DESC
      LIMIT 1
    `;

    try {
      const result = await pool.query<{ state_json: string | FullGameState }>(query, [matchId]);
      if (result.rows.length === 0) return null;
      const data = result.rows[0].state_json;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      logger.error(`GameRepo: Error fetching latest game state for match ${matchId}:`, err);
      return null;
    }
  }

  async getMatchEvents(matchId: string, limit = 50): Promise<any[]> {
    const pool = getDatabasePool();
    const query = `
      SELECT id, match_id, player_id, event_type, event_data, timestamp
      FROM match_events
      WHERE match_id = $1
      ORDER BY timestamp ASC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [matchId, limit]);
      return result.rows;
    } catch (err) {
      logger.error(`GameRepo: Error fetching match events for match ${matchId}:`, err);
      return [];
    }
  }

  async getAllGameStates(matchId: string): Promise<{ state_version: number; state_json: FullGameState }[]> {
    const pool = getDatabasePool();
    const query = `
      SELECT state_version, state_json
      FROM game_states
      WHERE match_id = $1
      ORDER BY state_version ASC
    `;
    try {
      const result = await pool.query(query, [matchId]);
      return result.rows.map(row => ({
        state_version: row.state_version,
        state_json: typeof row.state_json === 'string' ? JSON.parse(row.state_json) : row.state_json
      }));
    } catch (err) {
      logger.error(`GameRepo: Error fetching all game states for match ${matchId}:`, err);
      return [];
    }
  }

  async persistReplay(
    matchId: string,
    durationSeconds: number,
    initialState: FullGameState,
    eventTimeline: any[],
    finalState: FullGameState | null
  ): Promise<void> {
    const pool = getDatabasePool();
    const id = randomUUID();
    const query = `
      INSERT INTO replay_records (id, match_id, duration_seconds, initial_state, event_timeline, final_state, replay_version)
      VALUES ($1, $2, $3, $4, $5, $6, 1)
    `;

    // Important: We do not catch and swallow errors silently here as instructed by prompt. 
    // It should bubble up to the caller to maintain retry safety.
    await pool.query(query, [
      id,
      matchId,
      durationSeconds,
      JSON.stringify(initialState),
      JSON.stringify(eventTimeline),
      finalState ? JSON.stringify(finalState) : null
    ]);
  }

  async getReplay(matchId: string): Promise<any | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT id, match_id, duration_seconds, initial_state, event_timeline, final_state, replay_version, created_at
      FROM replay_records
      WHERE match_id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [matchId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      matchId: row.match_id,
      durationSeconds: row.duration_seconds,
      initialState: typeof row.initial_state === 'string' ? JSON.parse(row.initial_state) : row.initial_state,
      eventTimeline: typeof row.event_timeline === 'string' ? JSON.parse(row.event_timeline) : row.event_timeline,
      finalState: row.final_state ? (typeof row.final_state === 'string' ? JSON.parse(row.final_state) : row.final_state) : null,
      replayVersion: row.replay_version,
      createdAt: row.created_at
    };
  }
}

export const gameRepository = new PostgresGameRepository();
