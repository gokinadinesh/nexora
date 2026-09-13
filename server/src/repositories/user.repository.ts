import { CreateUserDTO, UpdateProfileDTO, UserRow } from '../models/user.model';
import { LeaderboardResponse, PlayerRankResponse } from '@nexora/shared';
import { firestoreUserRepository, FirestoreUserRepository } from './firestore-user.repository';

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

export { firestoreUserRepository, FirestoreUserRepository };
export const userRepository: IUserRepository = firestoreUserRepository;
