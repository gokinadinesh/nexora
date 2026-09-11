import { MATCH_STATUS, MatchResultDetails, FullGameState } from '@nexora/shared';
import { matchRepository, FinalizePlayerParams } from '../repositories/match.repository';
import { userRepository } from '../repositories/user.repository';
import { gameRepository } from '../repositories/game.repository';
import { ratingService } from './rating.service';
import { matchSessionService } from './match-session.service';
import { progressionService } from './progression.service';
import { logger } from '../utils/logger';

export interface FinalizeGameParams {
  matchId: string;
  winnerId: string | null;
  scores: Record<string, number>;
  finalVersion: number;
}

export class MatchFinalizationService {
  /**
   * Finalizes a completed match idempotently.
   * Calculates authoritative ELO rating changes, updates user competitive statistics,
   * persists final match details, and cleans up active sessions.
   */
  async finalizeMatch(params: FinalizeGameParams): Promise<MatchResultDetails> {
    const { matchId, winnerId, scores, finalVersion } = params;

    // 1. Idempotency Check: Fetch match
    const match = await matchRepository.findMatchById(matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    // If already completed and finalized, return existing final result details
    if (match.status === MATCH_STATUS.COMPLETED) {
      const existingResult = await matchRepository.findMatchResultById(matchId);
      if (existingResult && (existingResult.durationSeconds > 0 || existingResult.players.some((p) => p.ratingChange !== 0))) {
        logger.info(`MatchFinalization: Match ${matchId} is already finalized, returning cached result`);
        return existingResult;
      }
    }

    const players = await matchRepository.findPlayersByMatchId(matchId);
    if (players.length === 0) {
      throw new Error(`No players found for match ${matchId}`);
    }

    // Fetch user rows for all players to get current ratings & stats
    const userIds = players.map((p) => p.user_id);
    const userRows = await userRepository.findByIds(userIds);
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    // 2. Compute Duration (at least 1s)
    const startTime = match.started_at
      ? new Date(match.started_at).getTime()
      : new Date(match.created_at).getTime();
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startTime) / 1000));

    // 3. Authoritative Rating Calculation
    // For 1v1 match:
    const finalizePlayers: FinalizePlayerParams[] = [];

    if (players.length === 2) {
      const p1 = players[0];
      const p2 = players[1];
      const u1 = userMap.get(p1.user_id);
      const u2 = userMap.get(p2.user_id);

      const r1 = Number(u1?.rating ?? 1000);
      const r2 = Number(u2?.rating ?? 1000);

      let actualOutcome1: 1 | 0.5 | 0 = 0.5;
      if (winnerId === p1.user_id) {
        actualOutcome1 = 1;
      } else if (winnerId === p2.user_id) {
        actualOutcome1 = 0;
      }

      const eloDiff = ratingService.calculateEloChangeForPlayers(r1, r2, actualOutcome1);

      finalizePlayers.push({
        userId: p1.user_id,
        score: scores[p1.user_id] ?? p1.score ?? 0,
        ratingBefore: r1,
        ratingAfter: eloDiff.newRatingA,
        ratingChange: eloDiff.deltaA,
      });

      finalizePlayers.push({
        userId: p2.user_id,
        score: scores[p2.user_id] ?? p2.score ?? 0,
        ratingBefore: r2,
        ratingAfter: eloDiff.newRatingB,
        ratingChange: eloDiff.deltaB,
      });
    } else {
      // N-Player Multiplayer Elo (Pairwise evaluation)
      const n = players.length;
      
      // We sort players by their score descending to determine placements
      const rankedPlayers = [...players].sort((a, b) => {
        const scoreA = scores[a.user_id] ?? a.score ?? 0;
        const scoreB = scores[b.user_id] ?? b.score ?? 0;
        if (winnerId === a.user_id) return -1;
        if (winnerId === b.user_id) return 1;
        return scoreB - scoreA;
      });

      const playerRatings = new Map<string, number>();
      for (const p of rankedPlayers) {
        const u = userMap.get(p.user_id);
        playerRatings.set(p.user_id, Number(u?.rating ?? 1000));
      }

      for (let i = 0; i < n; i++) {
        const p1 = rankedPlayers[i];
        const r1 = playerRatings.get(p1.user_id)!;
        let totalDelta = 0;

        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          
          const p2 = rankedPlayers[j];
          const r2 = playerRatings.get(p2.user_id)!;

          let outcome: 1 | 0.5 | 0 = 0.5;
          if (i < j) outcome = 1; // p1 placed higher than p2
          else if (i > j) outcome = 0; // p1 placed lower than p2

          const eloDiff = ratingService.calculateEloChangeForPlayers(r1, r2, outcome);
          totalDelta += eloDiff.deltaA;
        }

        // Average the pairwise deltas
        const avgDelta = Math.round(totalDelta / (n - 1));
        const finalRating = Math.max(100, r1 + avgDelta);

        finalizePlayers.push({
          userId: p1.user_id,
          score: scores[p1.user_id] ?? p1.score ?? 0,
          ratingBefore: r1,
          ratingAfter: finalRating,
          ratingChange: avgDelta,
        });
      }
    }

    // 4. Persist match finalization in DB
    await matchRepository.finalizeMatch({
      matchId,
      winnerId,
      endedAt,
      durationSeconds,
      finalVersion,
      players: finalizePlayers,
    });

    // 5. Update each player's competitive progression in DB
    const isDraw = winnerId === null;
    for (const fp of finalizePlayers) {
      const isWinner = winnerId === fp.userId;
      await userRepository.updateCompetitiveStats(fp.userId, {
        newRating: fp.ratingAfter,
        isWinner,
        isDraw,
        score: fp.score,
      });

      // 5.5 Update 100-Level Progression
      try {
        await progressionService.grantMatchXP(
          matchId,
          fp.userId,
          isWinner,
          isDraw,
          fp.score,
          durationSeconds
        );
      } catch (err) {
        logger.error(`MatchFinalization: Failed to grant XP for user ${fp.userId} in match ${matchId}`, err);
      }
    }

    // 6. Record audit log event
    await gameRepository.recordMatchEvent(matchId, null, 'MATCH_COMPLETED', {
      winnerId,
      durationSeconds,
      finalVersion,
      players: finalizePlayers.map((fp) => ({
        userId: fp.userId,
        score: fp.score,
        ratingBefore: fp.ratingBefore,
        ratingAfter: fp.ratingAfter,
        ratingChange: fp.ratingChange,
      })),
    });

    // 7. Persist Server-Authoritative Replay
    const gameStates = await gameRepository.getAllGameStates(matchId);
    const matchEvents = await gameRepository.getMatchEvents(matchId, 1000);
    
    // Attempt to synthesize the timeline from matchEvents
    // If gameStates are missing somehow, we just pass what we have
    const initialState = (gameStates.find(s => s.state_version === 1)?.state_json || {}) as FullGameState;
    const finalState = (gameStates.find(s => s.state_version === finalVersion)?.state_json || null) as FullGameState | null;
    
    await gameRepository.persistReplay(
      matchId,
      durationSeconds,
      initialState,
      matchEvents,
      finalState
    );

    // 8. Cleanup active match session in memory
    matchSessionService.endSession(matchId);

    // 8. Retrieve complete MatchResultDetails
    const resultDetails = await matchRepository.findMatchResultById(matchId);
    if (!resultDetails) {
      throw new Error(`Failed to retrieve result details for match ${matchId}`);
    }

    logger.info(
      `MatchFinalization: Successfully finalized match ${matchId}. Winner: ${winnerId ?? 'DRAW'}, Duration: ${durationSeconds}s`
    );

    return resultDetails;
  }
}

export const matchFinalizationService = new MatchFinalizationService();
