import {
  MATCH_STATUS,
  MatchFoundPayload,
  MatchPlayerSummary,
  MatchSessionDetails,
  QueueEntry,
} from '@nexora/shared';
import { matchRepository, IMatchRepository } from '../repositories/match.repository';
import { userRepository, IUserRepository } from '../repositories/user.repository';
import { matchSessionService, MatchSessionService } from './match-session.service';
import { ActiveMatchSession } from '../stores/match-session.store';
import { MatchRow, MatchPlayerRow, toMatchSessionDetails } from '../models/match.model';
import { gameEngine } from '../game';
import { logger } from '../utils/logger';

export class MatchService {
  constructor(
    private matchRepo: IMatchRepository = matchRepository,
    private userRepo: IUserRepository = userRepository,
    private sessionService: MatchSessionService = matchSessionService
  ) {}

  async createMatch(
    player1: QueueEntry,
    player2: QueueEntry
  ): Promise<{ match: MatchRow; session: ActiveMatchSession; matchFoundPayload: MatchFoundPayload }> {
    logger.info(`MatchService: Creating match between ${player1.username} and ${player2.username}`);

    // 1. Create persistent match in database
    const match = await this.matchRepo.createMatch(MATCH_STATUS.ACTIVE);

    // 2. Associate players in database
    await this.matchRepo.addPlayerToMatch(match.id, player1.userId);
    await this.matchRepo.addPlayerToMatch(match.id, player2.userId);

    // 3. Create active in-memory session
    const session = await this.sessionService.createSession(match.id, [
      { userId: player1.userId, socketId: player1.socketId },
      { userId: player2.userId, socketId: player2.socketId },
    ]);

    // 4. Initialize CyberGrid Game State in GameEngine
    gameEngine.initGame(
      match.id,
      { id: player1.userId, displayName: player1.displayName, rating: player1.rating },
      { id: player2.userId, displayName: player2.displayName, rating: player2.rating }
    );

    // 4. Construct safe player summaries
    const players: MatchPlayerSummary[] = [
      {
        id: player1.userId,
        username: player1.username,
        displayName: player1.displayName,
        avatar: player1.avatar,
        rating: player1.rating,
        status: 'ACTIVE',
        score: 0,
      },
      {
        id: player2.userId,
        username: player2.username,
        displayName: player2.displayName,
        avatar: player2.avatar,
        rating: player2.rating,
        status: 'ACTIVE',
        score: 0,
      },
    ];

    const matchFoundPayload: MatchFoundPayload = {
      matchId: match.id,
      players,
      status: MATCH_STATUS.ACTIVE,
      createdAt: Date.now(),
    };

    logger.info(`MatchService: Match ${match.id} successfully created and persisted`);
    return { match, session, matchFoundPayload };
  }

  async getMatchDetails(matchId: string, requestingUserId: string): Promise<MatchSessionDetails> {
    const match = await this.matchRepo.findMatchById(matchId);
    if (!match) {
      const error: any = new Error('Match not found');
      error.statusCode = 404;
      throw error;
    }

    const matchPlayers = await this.matchRepo.findPlayersByMatchId(matchId);
    const isMember = matchPlayers.some((mp) => mp.user_id === requestingUserId);

    if (!isMember) {
      const error: any = new Error('Access denied: You are not a participant in this match session');
      error.statusCode = 403;
      throw error;
    }

    const userIds = matchPlayers.map((mp) => mp.user_id);
    const users = await this.userRepo.findByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const gameState = gameEngine.getGameState(matchId);

    const playerSummaries: MatchPlayerSummary[] = matchPlayers.map((mp) => {
      const u = userMap.get(mp.user_id);
      const liveScore = gameState?.players[mp.user_id]?.score ?? mp.score;
      return {
        id: mp.user_id,
        username: u ? u.username : 'Unknown Operative',
        displayName: u?.display_name || u?.username || 'Unknown Operative',
        avatar: u?.avatar || 'default_operative',
        rating: u?.rating ?? 1000,
        status: mp.status,
        score: liveScore,
      };
    });

    return toMatchSessionDetails(match, playerSummaries);
  }

  async isUserInMatch(matchId: string, userId: string): Promise<boolean> {
    const matchPlayers = await this.matchRepo.findPlayersByMatchId(matchId);
    return matchPlayers.some((mp) => mp.user_id === userId);
  }

  async getMatchHistory(userId: string, page: number = 1, limit: number = 10) {
    return this.matchRepo.findMatchHistoryByUserId(userId, page, limit);
  }

  async getMatchResult(matchId: string, requestingUserId: string) {
    const isMember = await this.isUserInMatch(matchId, requestingUserId);
    if (!isMember) {
      const error: any = new Error('Access denied: You are not a participant in this match');
      error.statusCode = 403;
      throw error;
    }

    const result = await this.matchRepo.findMatchResultById(matchId);
    if (!result) {
      const error: any = new Error('Match result not found');
      error.statusCode = 404;
      throw error;
    }

    return result;
  }
}

export const matchService = new MatchService();
