import { MatchStatus, MatchPlayerSummary, MatchSessionDetails } from '@nexora/shared';
import { UserRow } from './user.model';

export interface MatchRow {
  id: string;
  status: MatchStatus;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  winner_id: string | null;
  duration_seconds?: number;
  final_version?: number;
}

export interface MatchPlayerRow {
  id: string;
  match_id: string;
  user_id: string;
  score: number;
  status: string;
  joined_at: Date;
  rating_before?: number;
  rating_after?: number;
  rating_change?: number;
}

export interface MatchWithPlayers extends MatchRow {
  players: (MatchPlayerRow & { user?: UserRow })[];
}

export function toMatchPlayerSummary(
  matchPlayer: MatchPlayerRow,
  user?: UserRow
): MatchPlayerSummary {
  return {
    id: user ? user.id : matchPlayer.user_id,
    username: user ? user.username : 'Unknown Operative',
    displayName: user?.display_name || user?.username || 'Unknown Operative',
    avatar: user?.avatar || 'default_operative',
    rating: user?.rating ?? 1000,
    status: matchPlayer.status,
    score: matchPlayer.score,
  };
}

export function toMatchSessionDetails(
  match: MatchRow,
  players: MatchPlayerSummary[]
): MatchSessionDetails {
  return {
    id: match.id,
    status: match.status,
    players,
    createdAt: match.created_at ? new Date(match.created_at).toISOString() : new Date().toISOString(),
    startedAt: match.started_at ? new Date(match.started_at).toISOString() : null,
    endedAt: match.ended_at ? new Date(match.ended_at).toISOString() : null,
    winnerId: match.winner_id,
  };
}
