import { request } from './api';
import { LeaderboardResponse, PlayerRankResponse } from '@nexora/shared';

export const leaderboardService = {
  async getLeaderboard(page: number = 1, limit: number = 20): Promise<LeaderboardResponse> {
    return request<LeaderboardResponse>(`/api/leaderboard?page=${page}&limit=${limit}`);
  },

  async getMyRank(): Promise<PlayerRankResponse> {
    return request<PlayerRankResponse>('/api/leaderboard/me');
  },
};
