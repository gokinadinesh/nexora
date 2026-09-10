import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthResponse, AuthenticatedUser, LoginRequest, RegisterRequest, User, GoogleLoginRequest } from '@nexora/shared';
import { IUserRepository, userRepository } from '../repositories/user.repository';
import { authProviderRepository } from '../repositories/auth-provider.repository';
import { toSafeUser } from '../models/user.model';
import { config } from '../config/env';
import { OAuth2Client } from 'google-auth-library';
import { progressionService } from './progression.service';

export class AuthService {
  constructor(private userRepo: IUserRepository = userRepository) {}

  /**
   * Registers a new user. Validates input, hashes password, and issues JWT.
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const { username, email, password } = data;

    // 1. Validation
    this.validateRegistrationInput(username, email, password);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // 2. Check for duplicate username
    const existingByUsername = await this.userRepo.findByUsername(normalizedUsername);
    if (existingByUsername) {
      const err: any = new Error('Username is already registered');
      err.statusCode = 409;
      throw err;
    }

    // 3. Check for duplicate email
    const existingByEmail = await this.userRepo.findByEmail(normalizedEmail);
    if (existingByEmail) {
      const err: any = new Error('Email is already registered');
      err.statusCode = 409;
      throw err;
    }

    // 4. Secure Password Hashing
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Safe UUID generation
    const id = crypto.randomUUID();

    // 6. Check operator role assignment (server-controlled)
    let role: 'PLAYER' | 'OPERATOR' = 'PLAYER';
    if (config.isProduction) {
      // In production, require explicit listing in OPERATOR_USERNAMES without generic fallbacks
      const configuredOperators = config.operatorUsernames;
      if (configuredOperators.length > 0 && configuredOperators.includes(normalizedUsername.toLowerCase())) {
        role = 'OPERATOR';
      }
    } else {
      // In development/testing, allow convenient defaults
      const configuredOperators = config.operatorUsernames.length > 0
        ? config.operatorUsernames
        : ['operator', 'nexus_operator', 'admin'];
      const isOperator =
        configuredOperators.includes(normalizedUsername.toLowerCase()) ||
        normalizedEmail === 'operator@nexora.io';
      role = isOperator ? 'OPERATOR' : 'PLAYER';
    }

    // 7. Create user record
    const userRow = await this.userRepo.create({
      id,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role,
    });

    await progressionService.initializeProgression(userRow.id);

    const safeUser: User = toSafeUser(userRow);

    // 8. Generate JWT
    const token = this.generateToken(safeUser);

    return {
      user: safeUser,
      token,
    };
  }

  /**
   * Authenticates an existing user and returns JWT.
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const { email, password } = data;

    if (!email || !password) {
      const err: any = new Error('Email and password are required');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const userRow = await this.userRepo.findByEmail(normalizedEmail);
    if (!userRow) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isPasswordValid) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const safeUser = toSafeUser(userRow);
    const token = this.generateToken(safeUser);

    return {
      user: safeUser,
      token,
    };
  }

  /**
   * Authenticates a user via Google Sign-In.
   */
  async googleLogin(data: GoogleLoginRequest): Promise<AuthResponse> {
    const { token } = data;
    if (!token) {
      const err: any = new Error('Google ID token is required');
      err.statusCode = 400;
      throw err;
    }

    if (!config.googleClientId) {
      const err: any = new Error('Google Sign-In is not configured on the server');
      err.statusCode = 501;
      throw err;
    }

    const client = new OAuth2Client(config.googleClientId);

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: token,
        audience: config.googleClientId,
      });
    } catch (e) {
      const err: any = new Error('Invalid Google token');
      err.statusCode = 401;
      throw err;
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      const err: any = new Error('Incomplete Google token payload');
      err.statusCode = 400;
      throw err;
    }

    const providerSub = payload.sub;
    const email = payload.email.toLowerCase();

    // 1. Check if we already have this google account linked
    const linkedProvider = await authProviderRepository.findByProvider('google', providerSub);
    
    let userRow;

    if (linkedProvider) {
      userRow = await this.userRepo.findById(linkedProvider.user_id);
      if (!userRow) {
        const err: any = new Error('Linked user not found');
        err.statusCode = 500;
        throw err;
      }
    } else {
      // 2. See if a user with this email already exists
      userRow = await this.userRepo.findByEmail(email);
      
      if (userRow) {
        // Link the existing account
        await authProviderRepository.linkProvider(userRow.id, 'google', providerSub);
      } else {
        // 3. Create a new user entirely
        const usernameBase = payload.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + Math.floor(Math.random() * 1000);
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);
        const id = crypto.randomUUID();

        userRow = await this.userRepo.create({
          id,
          username: usernameBase.substring(0, 24),
          email,
          passwordHash,
          role: 'PLAYER',
          displayName: payload.name ? payload.name.substring(0, 30) : usernameBase.substring(0, 30),
          avatar: payload.picture ? payload.picture.substring(0, 255) : 'default_operative'
        });

        await authProviderRepository.linkProvider(id, 'google', providerSub);
        await progressionService.initializeProgression(userRow.id);
      }
    }

    const safeUser = toSafeUser(userRow);
    const jwtToken = this.generateToken(safeUser);

    return {
      user: safeUser,
      token: jwtToken,
    };
  }

  /**
   * Generates a signed JWT with standard claims.
   */
  generateToken(user: AuthenticatedUser | User): string {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'PLAYER',
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  /**
   * Verifies and decodes a JWT token.
   */
  verifyToken(token: string): AuthenticatedUser {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
      return {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role || 'PLAYER',
      };
    } catch (err: any) {
      const authErr: any = new Error('Invalid or expired token');
      authErr.statusCode = 401;
      throw authErr;
    }
  }

  /**
   * Server-authoritative promotion to OPERATOR role.
   */
  async promoteToOperator(userId: string) {
    return this.userRepo.setRole(userId, 'OPERATOR');
  }

  private validateRegistrationInput(username?: string, email?: string, password?: string): void {
    if (!username || typeof username !== 'string') {
      const err: any = new Error('Username is required');
      err.statusCode = 400;
      throw err;
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 24) {
      const err: any = new Error('Username must be between 3 and 24 characters');
      err.statusCode = 400;
      throw err;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      const err: any = new Error('Username may only contain letters, numbers, and underscores');
      err.statusCode = 400;
      throw err;
    }

    if (!email || typeof email !== 'string') {
      const err: any = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      const err: any = new Error('Invalid email format');
      err.statusCode = 400;
      throw err;
    }

    if (!password || typeof password !== 'string') {
      const err: any = new Error('Password is required');
      err.statusCode = 400;
      throw err;
    }

    if (password.length < 8) {
      const err: any = new Error('Password must be at least 8 characters long');
      err.statusCode = 400;
      throw err;
    }
  }
}

export const authService = new AuthService();
