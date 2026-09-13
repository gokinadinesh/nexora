import { AuthResponse, AuthenticatedUser, User } from '@nexora/shared';
import { IUserRepository, userRepository } from '../repositories/user.repository';
import { toSafeUser } from '../models/user.model';
import { config } from '../config/env';
import { firebaseAuth, DecodedIdToken } from '../config/firebase';
import { progressionService } from './progression.service';
import { logger } from '../utils/logger';

export class AuthService {
  constructor(private userRepo: IUserRepository = userRepository) {}

  /**
   * Verifies a Firebase ID token using Firebase Admin SDK.
   */
  async verifyFirebaseToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await firebaseAuth.verifyIdToken(idToken);
    } catch (error: any) {
      const authErr: any = new Error(error.message || 'Invalid or expired Firebase token');
      authErr.statusCode = 401;
      throw authErr;
    }
  }

  /**
   * Resolves or creates a user record in Firestore given a decoded Firebase ID token.
   */
  async getOrCreateUser(
    decodedToken: DecodedIdToken,
    profile?: { username?: string; displayName?: string; avatar?: string }
  ): Promise<User> {
    const uid = decodedToken.uid;
    const email = (decodedToken.email || '').toLowerCase();

    // 1. Check if user exists by ID (Firebase UID)
    let userRow = await this.userRepo.findById(uid);

    // 2. If not found by ID, check by email (in case of re-linking or pre-existing accounts)
    if (!userRow && email) {
      userRow = await this.userRepo.findByEmail(email);
    }

    if (userRow) {
      return toSafeUser(userRow);
    }

    // 3. User does not exist, create new operative profile in Firestore
    const emailPrefix = email ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : 'operative';
    const fallbackUsername = (emailPrefix + Math.floor(Math.random() * 1000)).substring(0, 24);
    const username = (profile?.username || fallbackUsername).trim();
    const displayName = profile?.displayName || decodedToken.name || username;
    const avatar = profile?.avatar || decodedToken.picture || 'default_operative';

    // Operator role resolution (server-controlled)
    let role = 'PLAYER';
    const configuredOperators = config.operatorUsernames;
    if (
      (configuredOperators.length > 0 && configuredOperators.includes(username.toLowerCase())) ||
      email === 'operator@nexora.io'
    ) {
      role = 'OPERATOR';
    }

    try {
      userRow = await this.userRepo.create({
        id: uid,
        username,
        email: email || `${uid}@firebase.nexora.io`,
        passwordHash: '',
        displayName,
        avatar,
        role,
      });
    } catch (err: any) {
      // If username was already taken, retry with random suffix
      if (err.statusCode === 409) {
        const uniqueUsername = (username.substring(0, 18) + '_' + Math.floor(Math.random() * 9000 + 1000)).substring(0, 24);
        userRow = await this.userRepo.create({
          id: uid,
          username: uniqueUsername,
          email: email || `${uid}@firebase.nexora.io`,
          passwordHash: '',
          displayName,
          avatar,
          role,
        });
      } else {
        throw err;
      }
    }

    await progressionService.initializeProgression(userRow.id);
    logger.info(`AuthService: Created new Firestore user for UID ${uid} (${username})`);
    return toSafeUser(userRow);
  }

  /**
   * Verifies Firebase ID token and returns authenticated user details.
   */
  async verifyTokenAsync(idToken: string): Promise<AuthenticatedUser> {
    const decoded = await this.verifyFirebaseToken(idToken);
    const safeUser = await this.getOrCreateUser(decoded);
    return {
      id: safeUser.id,
      username: safeUser.username,
      email: safeUser.email,
      role: safeUser.role,
    };
  }

  /**
   * Synchronous token verification placeholder for compatibility.
   */
  verifyToken(idToken: string): AuthenticatedUser {
    // If a synchronous decode is needed, we verify asynchronously via verifyTokenAsync
    throw new Error('Please use verifyTokenAsync for Firebase ID token verification');
  }

  /**
   * Verifies a token and returns full User and token payload for the client.
   */
  async verifySession(idToken: string): Promise<AuthResponse> {
    const decoded = await this.verifyFirebaseToken(idToken);
    const user = await this.getOrCreateUser(decoded);
    return {
      user,
      token: idToken,
    };
  }

  /**
   * Server-authoritative promotion to OPERATOR role.
   */
  async promoteToOperator(userId: string) {
    return this.userRepo.setRole(userId, 'OPERATOR');
  }
}

export const authService = new AuthService();
