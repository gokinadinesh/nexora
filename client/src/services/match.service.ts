import { request } from './api';
import { MatchSessionDetails, MatchHistoryResponse, MatchResultDetails } from '@nexora/shared';

export const matchService = {
  async getMatch(matchId: string): Promise<MatchSessionDetails> {
    return request<MatchSessionDetails>(`/api/matches/${matchId}`);
  },

  async getHistory(page: number = 1, limit: number = 10): Promise<MatchHistoryResponse> {
    return request<MatchHistoryResponse>(`/api/matches/history?page=${page}&limit=${limit}`);
  },

  async getResult(matchId: string): Promise<MatchResultDetails> {
    return request<MatchResultDetails>(`/api/matches/${matchId}/result`);
  },

  async getReplay(matchId: string): Promise<any> {
    return request<any>(`/api/matches/${matchId}/replay`);
  },
};

