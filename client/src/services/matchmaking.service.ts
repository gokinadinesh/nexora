import { request } from './api';
import { MatchmakingJoinResponse, QueueStatus } from '@nexora/shared';

export const matchmakingService = {
  async joinQueue(socketId?: string): Promise<MatchmakingJoinResponse> {
    return request<MatchmakingJoinResponse>('/api/matchmaking/join', {
      method: 'POST',
      body: JSON.stringify({ socketId }),
    });
  },

  async leaveQueue(): Promise<{ status: QueueStatus }> {
    return request<{ status: QueueStatus }>('/api/matchmaking/leave', {
      method: 'POST',
    });
  },

  async getStatus(): Promise<{ status: QueueStatus; queuePosition?: number; queuedAt?: number }> {
    return request<{ status: QueueStatus; queuePosition?: number; queuedAt?: number }>('/api/matchmaking/status');
  },
};
