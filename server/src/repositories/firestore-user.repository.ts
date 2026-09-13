import { firestore, DocumentSnapshot, Transaction, QueryDocumentSnapshot } from '../config/firebase';
import { CreateUserDTO, UpdateProfileDTO, UserRow } from '../models/user.model';
import { LeaderboardEntry, LeaderboardResponse, PlayerRankResponse } from '@nexora/shared';
import { IUserRepository } from './user.repository';

function docToUserRow(doc: DocumentSnapshot): UserRow | null {
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    id: doc.id,
    username: data.username || '',
    email: data.email || '',
    password_hash: data.password_hash || '',
    display_name: data.display_name || data.displayName || data.username || null,
    avatar: data.avatar || 'default_operative',
    role: data.role || 'PLAYER',
    rating: data.rating != null ? Number(data.rating) : 1000,
    wins: data.wins != null ? Number(data.wins) : 0,
    losses: data.losses != null ? Number(data.losses) : 0,
    matches_played: data.matches_played != null ? Number(data.matches_played) : 0,
    total_score: data.total_score != null ? Number(data.total_score) : 0,
    best_score: data.best_score != null ? Number(data.best_score) : 0,
    current_win_streak: data.current_win_streak != null ? Number(data.current_win_streak) : 0,
    best_win_streak: data.best_win_streak != null ? Number(data.best_win_streak) : 0,
    created_at: data.created_at ? (typeof data.created_at === 'string' ? data.created_at : data.created_at.toDate ? data.created_at.toDate().toISOString() : String(data.created_at)) : new Date().toISOString(),
    updated_at: data.updated_at ? (typeof data.updated_at === 'string' ? data.updated_at : data.updated_at.toDate ? data.updated_at.toDate().toISOString() : String(data.updated_at)) : new Date().toISOString(),
    level: data.level != null ? Number(data.level) : 1,
    xp: data.xp != null ? Number(data.xp) : 0,
    milestone_title: data.milestone_title || 'Recruit',
  };
}

export class FirestoreUserRepository implements IUserRepository {
  private collection = firestore.collection('users');

  async create(data: CreateUserDTO): Promise<UserRow> {
    const existingEmail = await this.findByEmail(data.email);
    if (existingEmail) {
      const conflictError: any = new Error('Email is already registered');
      conflictError.statusCode = 409;
      throw conflictError;
    }

    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      const conflictError: any = new Error('Username is already taken');
      conflictError.statusCode = 409;
      throw conflictError;
    }

    const now = new Date().toISOString();
    const displayName = data.displayName || data.username;
    const avatar = data.avatar || 'default_operative';
    const role = data.role || 'PLAYER';

    const userDocData = {
      id: data.id,
      username: data.username,
      username_lower: data.username.toLowerCase(),
      email: data.email,
      email_lower: data.email.toLowerCase(),
      password_hash: data.passwordHash || '',
      display_name: displayName,
      avatar,
      role,
      is_pro: false,
      stripe_subscription_id: null,
      rating: 1000,
      wins: 0,
      losses: 0,
      matches_played: 0,
      total_score: 0,
      best_score: 0,
      current_win_streak: 0,
      best_win_streak: 0,
      created_at: now,
      updated_at: now,
      level: 1,
      xp: 0,
      milestone_title: 'Recruit',
    };

    await this.collection.doc(data.id).set(userDocData);
    const created = await this.findById(data.id);
    if (!created) throw new Error('Failed to create user');
    return created;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    if (!email) return null;
    const snap = await this.collection
      .where('email_lower', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) {
      // Fallback in case lowercase field wasn't populated
      const snapDirect = await this.collection
        .where('email', '==', email)
        .limit(1)
        .get();
      if (snapDirect.empty) return null;
      return docToUserRow(snapDirect.docs[0]);
    }
    return docToUserRow(snap.docs[0]);
  }

  async findByUsername(username: string): Promise<UserRow | null> {
    if (!username) return null;
    const snap = await this.collection
      .where('username_lower', '==', username.toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) {
      const snapDirect = await this.collection
        .where('username', '==', username)
        .limit(1)
        .get();
      if (snapDirect.empty) return null;
      return docToUserRow(snapDirect.docs[0]);
    }
    return docToUserRow(snap.docs[0]);
  }

  async findById(id: string): Promise<UserRow | null> {
    if (!id) return null;
    const doc = await this.collection.doc(id).get();
    return docToUserRow(doc);
  }

  async findByIds(ids: string[]): Promise<UserRow[]> {
    if (!ids || ids.length === 0) return [];
    const docs = await Promise.all(ids.map((id) => this.collection.doc(id).get()));
    return docs.map(docToUserRow).filter((u): u is UserRow => u !== null);
  }

  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<UserRow> {
    const userRef = this.collection.doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.displayName !== undefined) {
      updates.display_name = data.displayName.trim();
    }
    if (data.avatar !== undefined) {
      updates.avatar = data.avatar.trim();
    }

    await userRef.update(updates);
    const updated = await this.findById(userId);
    if (!updated) throw new Error('User not found after update');
    return updated;
  }

  async recordWin(userId: string, ratingDelta = 25): Promise<void> {
    const userRef = this.collection.doc(userId);
    await firestore.runTransaction(async (t: Transaction) => {
      const doc = await t.get(userRef);
      if (!doc.exists) return;
      const data = doc.data()!;
      t.update(userRef, {
        wins: (data.wins || 0) + 1,
        matches_played: (data.matches_played || 0) + 1,
        rating: (data.rating || 1000) + ratingDelta,
        updated_at: new Date().toISOString(),
      });
    });
  }

  async recordLoss(userId: string, ratingDelta = 20): Promise<void> {
    const userRef = this.collection.doc(userId);
    await firestore.runTransaction(async (t: Transaction) => {
      const doc = await t.get(userRef);
      if (!doc.exists) return;
      const data = doc.data()!;
      t.update(userRef, {
        losses: (data.losses || 0) + 1,
        matches_played: (data.matches_played || 0) + 1,
        rating: Math.max(100, (data.rating || 1000) - ratingDelta),
        updated_at: new Date().toISOString(),
      });
    });
  }

  async updateRating(userId: string, newRating: number): Promise<void> {
    await this.collection.doc(userId).update({
      rating: newRating,
      updated_at: new Date().toISOString(),
    });
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
    const userRef = this.collection.doc(userId);

    await firestore.runTransaction(async (t: Transaction) => {
      const doc = await t.get(userRef);
      if (!doc.exists) {
        throw new Error(`User ${userId} not found`);
      }

      const user = doc.data()!;
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

      t.update(userRef, {
        rating: newRating,
        wins: newWins,
        losses: newLosses,
        matches_played: newMatches,
        total_score: newTotalScore,
        best_score: newBestScore,
        current_win_streak: newWinStreak,
        best_win_streak: newBestWinStreak,
        updated_at: new Date().toISOString(),
      });
    });

    const updatedUser = await this.findById(userId);
    if (!updatedUser) throw new Error('User not found after competitive stats update');
    return updatedUser;
  }

  async findLeaderboard(page: number = 1, limit: number = 20): Promise<LeaderboardResponse> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    let total = 0;
    try {
      const countSnap = await this.collection.count().get();
      total = countSnap.data().count;
    } catch {
      const allSnap = await this.collection.select().get();
      total = allSnap.size;
    }

    const snap = await this.collection
      .orderBy('rating', 'desc')
      .orderBy('wins', 'desc')
      .offset(offset)
      .limit(safeLimit)
      .get();

    const entries: LeaderboardEntry[] = snap.docs.map((doc: QueryDocumentSnapshot, idx: number) => {
      const row = docToUserRow(doc)!;
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
        level: Number(row.level || 1),
        milestoneTitle: row.milestone_title || 'Recruit',
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

    const userRating = Number(user.rating || 1000);
    const userWins = Number(user.wins || 0);

    let higherCount = 0;
    try {
      const higherRatingSnap = await this.collection
        .where('rating', '>', userRating)
        .count()
        .get();
      const higherRatingCount = higherRatingSnap.data().count;

      const sameRatingHigherWinsSnap = await this.collection
        .where('rating', '==', userRating)
        .where('wins', '>', userWins)
        .count()
        .get();
      const sameRatingHigherWinsCount = sameRatingHigherWinsSnap.data().count;

      higherCount = higherRatingCount + sameRatingHigherWinsCount;
    } catch {
      const allUsers = await this.collection.select('rating', 'wins', 'created_at').get();
      for (const d of allUsers.docs) {
        const u = d.data();
        const r = Number(u.rating || 1000);
        const w = Number(u.wins || 0);
        if (r > userRating || (r === userRating && w > userWins)) {
          higherCount++;
        }
      }
    }

    const rank = higherCount + 1;
    const matchesPlayed = Number(user.matches_played || 0);
    const wins = Number(user.wins || 0);
    const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0;

    return {
      rank,
      rating: userRating,
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
    const userRef = this.collection.doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new Error(`User ${userId} not found`);
    }

    await userRef.update({
      role,
      updated_at: new Date().toISOString(),
    });

    const updated = await this.findById(userId);
    if (!updated) throw new Error('User not found after role update');
    return updated;
  }
}

export const firestoreUserRepository = new FirestoreUserRepository();
