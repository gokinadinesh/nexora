export const DEFAULT_K_FACTOR = 32;
export const MIN_RATING_FLOOR = 100;
export const DEFAULT_STARTING_RATING = 1000;

export interface RatingCalculationResult {
  winnerDelta: number;
  loserDelta: number;
  newWinnerRating: number;
  newLoserRating: number;
  expectedWinner: number;
  expectedLoser: number;
}

export class RatingService {
  private kFactor: number;

  constructor(kFactor: number = DEFAULT_K_FACTOR) {
    this.kFactor = kFactor;
  }

  /**
   * Calculates deterministic ELO rating adjustments for completed match.
   *
   * Expected score:
   * E_A = 1 / (1 + 10^((R_B - R_A) / 400))
   *
   * Rating delta:
   * Winner delta = round(K * (1 - E_winner))
   * Loser delta = round(K * (0 - E_loser))
   */
  calculateEloChange(
    winnerRating: number,
    loserRating: number,
    customK?: number
  ): RatingCalculationResult {
    const k = customK ?? this.kFactor;

    // Expected probabilities
    const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

    // Rating changes
    const rawWinnerDelta = Math.round(k * (1 - expectedWinner));
    const rawLoserDelta = Math.round(k * (0 - expectedLoser));

    // Winner delta should be at least +1 if they win
    const winnerDelta = Math.max(1, rawWinnerDelta);

    // Loser delta should be at most -1 (unless clamped by rating floor)
    let loserDelta = Math.min(-1, rawLoserDelta);

    const newWinnerRating = winnerRating + winnerDelta;
    let newLoserRating = loserRating + loserDelta;

    // Enforce rating floor
    if (newLoserRating < MIN_RATING_FLOOR) {
      newLoserRating = MIN_RATING_FLOOR;
      loserDelta = newLoserRating - loserRating;
    }

    return {
      winnerDelta,
      loserDelta,
      newWinnerRating,
      newLoserRating,
      expectedWinner: Math.round(expectedWinner * 1000) / 1000,
      expectedLoser: Math.round(expectedLoser * 1000) / 1000,
    };
  }

  calculateEloChangeForPlayers(
    ratingA: number,
    ratingB: number,
    outcomeA: 1 | 0.5 | 0,
    customK?: number
  ): {
    deltaA: number;
    deltaB: number;
    newRatingA: number;
    newRatingB: number;
  } {
    const k = customK ?? this.kFactor;
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 - expectedA;
    const outcomeB = 1 - outcomeA;

    let deltaA = Math.round(k * (outcomeA - expectedA));
    let deltaB = Math.round(k * (outcomeB - expectedB));

    if (outcomeA === 1) {
      deltaA = Math.max(1, deltaA);
      deltaB = Math.min(-1, deltaB);
    } else if (outcomeA === 0) {
      deltaA = Math.min(-1, deltaA);
      deltaB = Math.max(1, deltaB);
    }

    let newRatingA = ratingA + deltaA;
    let newRatingB = ratingB + deltaB;

    if (newRatingA < MIN_RATING_FLOOR) {
      newRatingA = MIN_RATING_FLOOR;
      deltaA = newRatingA - ratingA;
    }
    if (newRatingB < MIN_RATING_FLOOR) {
      newRatingB = MIN_RATING_FLOOR;
      deltaB = newRatingB - ratingB;
    }

    return {
      deltaA,
      deltaB,
      newRatingA,
      newRatingB,
    };
  }
}

export const ratingService = new RatingService();
