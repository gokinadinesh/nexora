import { randomUUID } from 'crypto';
import {
  MatchStatus,
  MATCH_STATUS,
  MatchResultDetails,
  MatchResultPlayer,
  MatchHistoryItem,
  MatchHistoryResponse,
} from '@nexora/shared';
import { firestore, Transaction, QueryDocumentSnapshot } from '../config/firebase';
import { MatchRow, MatchPlayerRow } from '../models/match.model';
import {
  IMatchRepository,
  FinalizeMatchParams,
} from './match.repository';

function toDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
}

function toDateOrNull(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
}

export class FirestoreMatchRepository implements IMatchRepository {
  private matchesCollection = firestore.collection('matches');

  async createMatch(status: MatchStatus = MATCH_STATUS.ACTIVE): Promise<MatchRow> {
    const id = randomUUID();
    const now = new Date();

    const matchData = {
      id,
      status,
      created_at: now.toISOString(),
      started_at: now.toISOString(),
      ended_at: null,
      winner_id: null,
      duration_seconds: 0,
      final_version: 1,
      player_ids: [] as string[],
      players: [] as any[],
    };

    await this.matchesCollection.doc(id).set(matchData);

    return {
      id,
      status,
      created_at: now,
      started_at: now,
      ended_at: null,
      winner_id: null,
      duration_seconds: 0,
      final_version: 1,
    };
  }

  async addPlayerToMatch(matchId: string, userId: string): Promise<MatchPlayerRow> {
    const id = randomUUID();
    const now = new Date();

    const playerRow: MatchPlayerRow = {
      id,
      match_id: matchId,
      user_id: userId,
      score: 0,
      status: 'ACTIVE',
      joined_at: now,
      rating_before: 1000,
      rating_after: 1000,
      rating_change: 0,
    };

    const matchRef = this.matchesCollection.doc(matchId);

    await firestore.runTransaction(async (t: Transaction) => {
      const doc = await t.get(matchRef);
      if (!doc.exists) {
        throw new Error(`Match ${matchId} not found`);
      }

      const matchData = doc.data()!;
      const playerIds: string[] = matchData.player_ids || [];
      const players: any[] = matchData.players || [];

      if (!playerIds.includes(userId)) {
        playerIds.push(userId);
      }

      players.push({
        ...playerRow,
        joined_at: now.toISOString(),
      });

      t.update(matchRef, {
        player_ids: playerIds,
        players,
      });

      // Also write to subcollection for individual player doc queries
      const playerSubRef = matchRef.collection('players').doc(userId);
      t.set(playerSubRef, {
        ...playerRow,
        joined_at: now.toISOString(),
      });
    });

    return playerRow;
  }

  async findMatchById(id: string): Promise<MatchRow | null> {
    const doc = await this.matchesCollection.doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return {
      id: doc.id,
      status: data.status,
      created_at: toDate(data.created_at),
      started_at: toDateOrNull(data.started_at),
      ended_at: toDateOrNull(data.ended_at),
      winner_id: data.winner_id || null,
      duration_seconds: Number(data.duration_seconds || 0),
      final_version: Number(data.final_version || 1),
    };
  }

  async findPlayersByMatchId(matchId: string): Promise<MatchPlayerRow[]> {
    const doc = await this.matchesCollection.doc(matchId).get();
    if (!doc.exists) return [];
    const data = doc.data()!;

    if (Array.isArray(data.players) && data.players.length > 0) {
      return data.players.map((p: any) => ({
        id: p.id,
        match_id: p.match_id || matchId,
        user_id: p.user_id,
        score: Number(p.score || 0),
        status: p.status || 'ACTIVE',
        joined_at: toDate(p.joined_at),
        rating_before: Number(p.rating_before ?? 1000),
        rating_after: Number(p.rating_after ?? 1000),
        rating_change: Number(p.rating_change ?? 0),
      }));
    }

    // Subcollection fallback
    const subSnap = await this.matchesCollection.doc(matchId).collection('players').get();
    return subSnap.docs.map((d: QueryDocumentSnapshot) => {
      const p = d.data();
      return {
        id: p.id || d.id,
        match_id: p.match_id || matchId,
        user_id: p.user_id,
        score: Number(p.score || 0),
        status: p.status || 'ACTIVE',
        joined_at: toDate(p.joined_at),
        rating_before: Number(p.rating_before ?? 1000),
        rating_after: Number(p.rating_after ?? 1000),
        rating_change: Number(p.rating_change ?? 0),
      };
    });
  }

  async updateMatchStatus(
    id: string,
    status: MatchStatus,
    endedAt?: Date,
    winnerId?: string
  ): Promise<MatchRow> {
    const matchRef = this.matchesCollection.doc(id);
    const doc = await matchRef.get();
    if (!doc.exists) {
      throw new Error(`Match ${id} not found`);
    }

    const updates: Record<string, any> = {
      status,
      ended_at: endedAt ? endedAt.toISOString() : null,
      winner_id: winnerId || null,
    };

    await matchRef.update(updates);
    const updated = await this.findMatchById(id);
    if (!updated) throw new Error(`Match ${id} not found after update`);
    return updated;
  }

  async findActiveMatchByUserId(userId: string): Promise<MatchRow | null> {
    // Look for matches with PENDING or ACTIVE status containing this user
    const pendingSnap = await this.matchesCollection
      .where('player_ids', 'array-contains', userId)
      .where('status', 'in', ['PENDING', 'ACTIVE'])
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    if (pendingSnap.empty) return null;
    const doc = pendingSnap.docs[0];
    const data = doc.data();

    return {
      id: doc.id,
      status: data.status,
      created_at: toDate(data.created_at),
      started_at: toDateOrNull(data.started_at),
      ended_at: toDateOrNull(data.ended_at),
      winner_id: data.winner_id || null,
      duration_seconds: Number(data.duration_seconds || 0),
      final_version: Number(data.final_version || 1),
    };
  }

  async finalizeMatch(params: FinalizeMatchParams): Promise<MatchRow> {
    const matchRef = this.matchesCollection.doc(params.matchId);

    await firestore.runTransaction(async (t: Transaction) => {
      const doc = await t.get(matchRef);
      if (!doc.exists) {
        throw new Error(`Match ${params.matchId} not found`);
      }

      const matchData = doc.data()!;
      const existingPlayers: any[] = matchData.players || [];

      const updatedPlayers = existingPlayers.map((p) => {
        const pParam = params.players.find((param) => param.userId === p.user_id);
        if (pParam) {
          return {
            ...p,
            score: pParam.score,
            rating_before: pParam.ratingBefore,
            rating_after: pParam.ratingAfter,
            rating_change: pParam.ratingChange,
            status: 'COMPLETED',
          };
        }
        return p;
      });

      // Update match document
      t.update(matchRef, {
        status: MATCH_STATUS.COMPLETED,
        ended_at: params.endedAt.toISOString(),
        winner_id: params.winnerId || null,
        duration_seconds: params.durationSeconds,
        final_version: params.finalVersion,
        players: updatedPlayers,
      });

      // Update subcollection docs
      for (const p of params.players) {
        const playerSubRef = matchRef.collection('players').doc(p.userId);
        t.set(
          playerSubRef,
          {
            score: p.score,
            rating_before: p.ratingBefore,
            rating_after: p.ratingAfter,
            rating_change: p.ratingChange,
            status: 'COMPLETED',
          },
          { merge: true }
        );
      }
    });

    const updated = await this.findMatchById(params.matchId);
    if (!updated) throw new Error(`Match ${params.matchId} not found after finalize`);
    return updated;
  }

  async findMatchResultById(matchId: string): Promise<MatchResultDetails | null> {
    const matchDoc = await this.matchesCollection.doc(matchId).get();
    if (!matchDoc.exists) return null;

    const matchData = matchDoc.data()!;
    const playersRaw: any[] = matchData.players || [];

    // Fetch user profiles for all players in this match
    const userIds = playersRaw.map((p) => p.user_id);
    const userDocs = await Promise.all(
      userIds.map((uid) => firestore.collection('users').doc(uid).get())
    );

    const userMap = new Map<string, any>();
    for (const uDoc of userDocs) {
      if (uDoc.exists) {
        userMap.set(uDoc.id, uDoc.data());
      }
    }

    const players: MatchResultPlayer[] = playersRaw.map((p) => {
      const u = userMap.get(p.user_id);
      const isWinner = matchData.winner_id ? matchData.winner_id === p.user_id : false;
      return {
        userId: p.user_id,
        username: u?.username || 'Unknown Operative',
        displayName: u?.display_name || u?.username || 'Unknown Operative',
        avatar: u?.avatar || 'default_operative',
        score: Number(p.score || 0),
        ratingBefore: Number(p.rating_before ?? 1000),
        ratingAfter: Number(p.rating_after ?? 1000),
        ratingChange: Number(p.rating_change ?? 0),
        isWinner,
      };
    });

    players.sort((a, b) => b.score - a.score);
    const winner = players.find((p) => p.isWinner) || null;

    return {
      matchId,
      status: matchData.status,
      winnerId: matchData.winner_id || null,
      winner,
      durationSeconds: Number(matchData.duration_seconds || 0),
      startedAt: matchData.started_at ? new Date(matchData.started_at).toISOString() : new Date().toISOString(),
      endedAt: matchData.ended_at ? new Date(matchData.ended_at).toISOString() : null,
      finalVersion: Number(matchData.final_version || 1),
      players,
    };
  }

  async findMatchHistoryByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<MatchHistoryResponse> {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    // Count user's completed matches
    let total = 0;
    try {
      const countSnap = await this.matchesCollection
        .where('player_ids', 'array-contains', userId)
        .where('status', '==', 'COMPLETED')
        .count()
        .get();
      total = countSnap.data().count;
    } catch {
      const allMatchesSnap = await this.matchesCollection
        .where('player_ids', 'array-contains', userId)
        .where('status', '==', 'COMPLETED')
        .select()
        .get();
      total = allMatchesSnap.size;
    }

    if (total === 0) {
      return {
        matches: [],
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1,
      };
    }

    const snap = await this.matchesCollection
      .where('player_ids', 'array-contains', userId)
      .where('status', '==', 'COMPLETED')
      .orderBy('ended_at', 'desc')
      .offset(offset)
      .limit(safeLimit)
      .get();

    // Collect all opponent user IDs
    const opponentIds = new Set<string>();
    for (const d of snap.docs) {
      const data = d.data();
      const pIds: string[] = data.player_ids || [];
      for (const pid of pIds) {
        if (pid !== userId) opponentIds.add(pid);
      }
    }

    // Fetch opponent user docs
    const oppUserDocs = await Promise.all(
      Array.from(opponentIds).map((id) => firestore.collection('users').doc(id).get())
    );
    const oppUserMap = new Map<string, any>();
    for (const d of oppUserDocs) {
      if (d.exists) {
        oppUserMap.set(d.id, d.data());
      }
    }

    const matches: MatchHistoryItem[] = snap.docs.map((doc: QueryDocumentSnapshot) => {
      const m = doc.data();
      const players: any[] = m.players || [];
      const userPlayer = players.find((p) => p.user_id === userId);
      const oppPlayer = players.find((p) => p.user_id !== userId);
      const oppUser = oppPlayer ? oppUserMap.get(oppPlayer.user_id) : null;

      let result: 'VICTORY' | 'DEFEAT' | 'DRAW' = 'DRAW';
      if (m.winner_id) {
        result = m.winner_id === userId ? 'VICTORY' : 'DEFEAT';
      }

      return {
        matchId: doc.id,
        result,
        myScore: Number(userPlayer?.score || 0),
        opponentScore: Number(oppPlayer?.score || 0),
        ratingBefore: Number(userPlayer?.rating_before ?? 1000),
        ratingAfter: Number(userPlayer?.rating_after ?? 1000),
        ratingChange: Number(userPlayer?.rating_change || 0),
        opponent: {
          id: oppPlayer?.user_id || 'unknown',
          username: oppUser?.username || oppPlayer?.username || 'Opponent',
          displayName: oppUser?.display_name || oppUser?.username || 'Opponent Operative',
          avatar: oppUser?.avatar || 'default_operative',
          rating: Number(oppPlayer?.rating_after ?? oppUser?.rating ?? 1000),
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

export const firestoreMatchRepository = new FirestoreMatchRepository();
