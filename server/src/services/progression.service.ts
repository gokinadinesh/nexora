import { getDatabasePool } from '../config/db';
import { logger } from '../utils/logger';

export const MAX_LEVEL = 100;
export const XP_MULTIPLIER = 500; // xp required = 500 * (level - 1)^2
// Let's use: level = Math.floor(Math.sqrt(xp / 500)) + 1

export function calculateLevel(xp: number): number {
  if (xp < 0) return 1;
  const rawLevel = Math.floor(Math.sqrt(xp / XP_MULTIPLIER)) + 1;
  return Math.min(MAX_LEVEL, rawLevel);
}

export function getMilestoneTitle(level: number): string {
  if (level >= 100) return 'NEXORA Legend';
  if (level >= 90) return 'Nexus Vanguard';
  if (level >= 80) return 'Prime Hacker';
  if (level >= 70) return 'Systems Architect';
  if (level >= 60) return 'Grid Master';
  if (level >= 50) return 'Shadow Runner';
  if (level >= 40) return 'Cyber Technician';
  if (level >= 30) return 'Specialist';
  if (level >= 20) return 'Elite Operative';
  if (level >= 10) return 'Operative';
  return 'Recruit';
}

export interface XPTransactionResult {
  userId: string;
  previousXp: number;
  newXp: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newMilestone: string;
}

export class ProgressionService {
  /**
   * Initializes player progression if it doesn't exist.
   */
  async initializeProgression(userId: string): Promise<void> {
    const pool = getDatabasePool();
    await pool.query(
      `INSERT INTO player_progression (user_id, level, xp, milestone_title)
       VALUES ($1, 1, 0, 'Recruit')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
  }

  /**
   * Fetches progression for a user. Initializes if not found.
   */
  async getProgression(userId: string) {
    const pool = getDatabasePool();
    let result = await pool.query(
      'SELECT level, xp, milestone_title FROM player_progression WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      await this.initializeProgression(userId);
      result = await pool.query(
        'SELECT level, xp, milestone_title FROM player_progression WHERE user_id = $1',
        [userId]
      );
    }
    return result.rows[0];
  }

  /**
   * Grants XP to a player and records the transaction.
   * Calculates new level and handles milestone title updates.
   */
  async grantXP(
    userId: string,
    amount: number,
    source: string,
    matchId: string | null = null,
    idempotencyKey: string | null = null
  ): Promise<XPTransactionResult | null> {
    const pool = getDatabasePool();

    // Check idempotency key first if provided
    if (idempotencyKey) {
      const existing = await pool.query(
        'SELECT transaction_id FROM xp_transactions WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        logger.info(`ProgressionService: Skipping duplicate XP transaction for key ${idempotencyKey}`);
        return null; // Already processed
      }
    }

    const currentProgression = await this.getProgression(userId);
    const previousXp = currentProgression.xp;
    const previousLevel = currentProgression.level;

    const newXp = previousXp + amount;
    const newLevel = calculateLevel(newXp);
    const newMilestone = getMilestoneTitle(newLevel);
    const leveledUp = newLevel > previousLevel;

    // Use a transaction or sequential queries (pg-mem friendly where transactions might be tricky, but sequential is fine for this case)
    // 1. Insert transaction record
    await pool.query(
      `INSERT INTO xp_transactions 
       (user_id, match_id, source, amount, previous_xp, new_xp, previous_level, new_level, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, matchId, source, amount, previousXp, newXp, previousLevel, newLevel, idempotencyKey]
    );

    // 2. Update player_progression
    await pool.query(
      `UPDATE player_progression 
       SET xp = $1, level = $2, milestone_title = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [newXp, newLevel, newMilestone, userId]
    );

    if (leveledUp) {
      logger.info(`ProgressionService: Player ${userId} leveled up to ${newLevel} (${newMilestone})!`);
    }

    return {
      userId,
      previousXp,
      newXp,
      previousLevel,
      newLevel,
      leveledUp,
      newMilestone
    };
  }

  /**
   * Grant XP for match participation based on outcome and performance.
   */
  async grantMatchXP(
    matchId: string,
    userId: string,
    isWinner: boolean,
    isDraw: boolean,
    score: number,
    durationSeconds: number
  ): Promise<XPTransactionResult | null> {
    let amount = 0;
    
    // Base outcome XP
    if (isWinner) amount += 200;
    else if (isDraw) amount += 100;
    else amount += 50;

    // Performance bonus
    amount += Math.floor(score / 10);
    
    // Duration bonus (max 100 for a 1000s match)
    amount += Math.min(100, Math.floor(durationSeconds / 10));

    const source = isWinner ? 'MATCH_WIN' : (isDraw ? 'MATCH_DRAW' : 'MATCH_LOSS');
    const idempotencyKey = `match_xp_${matchId}_${userId}`;

    return this.grantXP(userId, amount, source, matchId, idempotencyKey);
  }
}

export const progressionService = new ProgressionService();
