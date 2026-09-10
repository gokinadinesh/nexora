import { LobbyResponse } from '@nexora/shared';
import { request } from './api';

export const lobbyService = {
  async getLobby(): Promise<LobbyResponse> {
    return request<LobbyResponse>('/api/lobby');
  },
};
