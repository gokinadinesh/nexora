import { firestore } from '../config/firebase';
import { logger } from '../utils/logger';

export const MAX_LEVEL = 100;
export const XP_MULTIPLIER = 500; // xp required = 500 * (level - 1)^2
// level = Math.floor(Math.sqrt(xp / 500)) + 1

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
  private progressionCollection = firestore.collection('player_progression');
  private transactionsCollection = firestore.collection('xp_transactions');
  private usersCollection = firestore.collection('users');

  /**
   * Initializes player progression if it doesn't exist.
   */
  async initializeProgression(userId: string): Promise<void> {
    const docRef = this.progressionCollection.doc(userId);
    const doc = await docRef.get();
    if (!doc.exists) {
      const now = new Date().toISOString();
      await docRef.set({
        user_id: userId,
        level: 1,
        xp: 0,
        milestone_title: 'Recruit',
        created_at: now,
        updated_at: now,
      });

      // Also ensure user doc has level & xp
      await this.usersCollection.doc(userId).set(
        {
          level: 1,
          xp: 0,
          milestone_title: 'Recruit',
          updated_at: now,
        },
        { merge: true }
      );
    }
  }

  /**
   * Fetches progression for a user. Initializes if not found.
   */
  async getProgression(userId: string): Promise<{ level: number; xp: number; milestone_title: string }> {
    const docRef = this.progressionCollection.doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      await this.initializeProgression(userId);
      const newDoc = await docRef.get();
      const data = newDoc.data();
      return {
        level: Number(data?.level ?? 1),
        xp: Number(data?.xp ?? 0),
        milestone_title: data?.milestone_title || 'Recruit',
      };
    }

    const data = doc.data();
    return {
      level: Number(data?.level ?? 1),
      xp: Number(data?.xp ?? 0),
      milestone_title: data?.milestone_title || 'Recruit',
    };
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
    // Check idempotency key first if provided
    if (idempotencyKey) {
      const existing = await this.transactionsCollection
        .where('idempotency_key', '==', idempotencyKey)
        .limit(1)
        .get();
      if (!existing.empty) {
        logger.info(`ProgressionService: Skipping duplicate XP transaction for key ${idempotencyKey}`);
        return null;
      }
    }

    const currentProgression = await this.getProgression(userId);
    const previousXp = currentProgression.xp;
    const previousLevel = currentProgression.level;

    const newXp = previousXp + amount;
    const newLevel = calculateLevel(newXp);
    const newMilestone = getMilestoneTitle(newLevel);
    const leveledUp = newLevel > previousLevel;
    const now = new Date().toISOString();

    // 1. Insert transaction record
    await this.transactionsCollection.add({
      user_id: userId,
      match_id: matchId,
      source,
      amount,
      previous_xp: previousXp,
      new_xp: newXp,
      previous_level: previousLevel,
      new_level: newLevel,
      idempotency_key: idempotencyKey,
      created_at: now,
    });

    // 2. Update player_progression
    await this.progressionCollection.doc(userId).set(
      {
        user_id: userId,
        xp: newXp,
        level: newLevel,
        milestone_title: newMilestone,
        updated_at: now,
      },
      { merge: true }
    );

    // 3. Update user document
    await this.usersCollection.doc(userId).set(
      {
        xp: newXp,
        level: newLevel,
        milestone_title: newMilestone,
        updated_at: now,
      },
      { merge: true }
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
      newMilestone,
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

    const source = isWinner ? 'MATCH_WIN' : isDraw ? 'MATCH_DRAW' : 'MATCH_LOSS';
    const idempotencyKey = `match_xp_${matchId}_${userId}`;

    return this.grantXP(userId, amount, source, matchId, idempotencyKey);
  }
}

export const progressionService = new ProgressionService();
