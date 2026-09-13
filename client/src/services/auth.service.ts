import {
  AuthResponse,
  AuthenticatedUser,
  LoginRequest,
  PlayerProfile,
  ProfileUpdateRequest,
  RegisterRequest,
} from '@nexora/shared';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile as updateFirebaseProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { request, setStoredToken, clearStoredToken } from './api';

export const authService = {
  /**
   * Register a new operative with Firebase Authentication and initialize their profile.
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    
    // Set display name in Firebase Auth
    if (data.username) {
      await updateFirebaseProfile(credential.user, {
        displayName: data.username,
      });
    }

    const token = await credential.user.getIdToken();
    setStoredToken(token);

    // Sync profile and initialize in backend Firestore
    const syncRes = await request<AuthResponse>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    return syncRes;
  },

  /**
   * Log in an existing operative with Firebase Authentication.
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const credential = await signInWithEmailAndPassword(auth, data.email, data.password);
    const token = await credential.user.getIdToken();
    setStoredToken(token);

    // Sync session with backend
    const syncRes = await request<AuthResponse>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    return syncRes;
  },

  /**
   * Authenticate using Google via Firebase popup.
   */
  async loginWithGoogle(): Promise<AuthResponse> {
    const credential = await signInWithPopup(auth, googleProvider);
    const token = await credential.user.getIdToken();
    setStoredToken(token);

    const syncRes = await request<AuthResponse>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    return syncRes;
  },

  /**
   * Verifies an existing token with the backend.
   */
  async verifySession(token: string): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
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

  async logout(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore signOut errors
    } finally {
      clearStoredToken();
    }
  },
};
