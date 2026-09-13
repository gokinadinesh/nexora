import {
  MatchStatus,
  MatchResultDetails,
  MatchHistoryResponse,
} from '@nexora/shared';
import { MatchRow, MatchPlayerRow } from '../models/match.model';
import { firestoreMatchRepository, FirestoreMatchRepository } from './firestore-match.repository';

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

export { firestoreMatchRepository, FirestoreMatchRepository };
export const matchRepository: IMatchRepository = firestoreMatchRepository;
