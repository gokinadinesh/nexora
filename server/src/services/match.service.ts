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
    level: any,
    players: QueueEntry[]
  ): Promise<{ match: MatchRow; session: ActiveMatchSession; matchFoundPayload: MatchFoundPayload }> {
    logger.info(`MatchService: Creating match for players: ${players.map(p => p.username).join(', ')}`);

    // 1. Create persistent match in database
    const match = await this.matchRepo.createMatch(MATCH_STATUS.ACTIVE);

    // 2. Associate players in database
    for (const p of players) {
      await this.matchRepo.addPlayerToMatch(match.id, p.userId);
    }

    // 3. Create active in-memory session
    const sessionArgs = players.map(p => ({ userId: p.userId, socketId: p.socketId }));
    const session = await this.sessionService.createSession(match.id, sessionArgs);

    // 4. Initialize CyberGrid Game State in GameEngine
    const enginePlayers = players.map(p => ({
      id: p.userId,
      displayName: p.displayName,
      rating: p.rating
    }));
    gameEngine.initGame(match.id, level, enginePlayers);

    // 4. Construct safe player summaries
    const playerSummaries: MatchPlayerSummary[] = players.map(p => ({
      id: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar,
      rating: p.rating,
      status: 'ACTIVE',
      score: 0,
    }));

    const matchFoundPayload: MatchFoundPayload = {
      matchId: match.id,
      players: playerSummaries,
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

  async getMatchReplay(matchId: string, requestingUserId: string) {
    const isMember = await this.isUserInMatch(matchId, requestingUserId);
    if (!isMember) {
      // In the future, operators could be allowed, but for now we restrict to participants
      const error: any = new Error('Access denied: You are not authorized to view this match replay');
      error.statusCode = 403;
      throw error;
    }

    const { gameRepository } = require('../repositories/game.repository');
    const replay = await gameRepository.getReplay(matchId);
    
    if (!replay) {
      const error: any = new Error('Replay not found or match not yet completed');
      error.statusCode = 404;
      throw error;
    }

    return replay;
  }
}

export const matchService = new MatchService();
