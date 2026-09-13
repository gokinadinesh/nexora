import {
  AuthResponse,
  AuthenticatedUser,

  LoginRequest,
  PlayerProfile,
  ProfileUpdateRequest,
  RegisterRequest,
} from '@nexora/shared';
import { request, setStoredToken, clearStoredToken } from './api';

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const result = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (result.token) {
      setStoredToken(result.token);
    }

    return result;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const result = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (result.token) {
      setStoredToken(result.token);
    }

    return result;
  },



  async getMe(): Promise<AuthenticatedUser> {
    return request<AuthenticatedUser>('/api/me');
  },

  async getProfile(): Promise<PlayerProfile> {
    return request<PlayerProfile>('/api/profile');
  },

  async updateProfile(data: ProfileUpdateRequest): Promise<PlayerProfile> {
    return request<PlayerProfile>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  logout(): void {
    clearStoredToken();
  },
};
