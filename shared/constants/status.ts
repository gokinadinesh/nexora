export const PLAYER_STATUS = {
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
  QUEUED: 'QUEUED',
  IN_GAME: 'IN_GAME',
} as const;

export type PlayerStatus = typeof PLAYER_STATUS[keyof typeof PLAYER_STATUS];

export const MATCH_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

export const QUEUE_STATUS = {
  NOT_QUEUED: 'NOT_QUEUED',
  QUEUED: 'QUEUED',
  MATCH_FOUND: 'MATCH_FOUND',
} as const;

export type QueueStatus = typeof QUEUE_STATUS[keyof typeof QUEUE_STATUS];
