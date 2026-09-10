import { PlayerStatus, MatchStatus, QueueStatus } from '../constants/status';

export interface HealthResponse {
  status: string;
  service: string;
  services?: {
    server: string;
    database: string;
    websocket: string;
    matchmaking: string;
    [key: string]: string;
  };
  timestamp?: string;
}

export type UserRole = 'PLAYER' | 'OPERATOR';

export interface Player {
  id: string;
  username: string;
  status: PlayerStatus;
}

export interface MatchSummary {
  matchId: string;
  status: MatchStatus;
  playerIds: string[];
  createdAt: number;
}

// Authentication & User Contracts (Safe - Never include password_hash)

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  avatar?: string;
  role?: UserRole;
  rating?: number;
  wins?: number;
  losses?: number;
  matchesPlayed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role?: UserRole;
}

// Player Competitive Profile (Safe - Never exposed credentials or hashes)

export interface PlayerProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  role?: UserRole;
  rating: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  status: PlayerStatus | string;
  createdAt: string;
  totalScore?: number;
  bestScore?: number;
  currentWinStreak?: number;
  bestWinStreak?: number;
  winRate?: number;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  avatar?: string;
}

// Lobby Contracts

export interface LobbyPlayer {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  rating: number;
  status: PlayerStatus | string;
}

export interface LobbyResponse {
  playersOnline: number;
  players: LobbyPlayer[];
}

// Socket & Matchmaking Preparation Payloads

export interface SocketAuthPayload {
  token?: string;
}

export interface QueueStatusPayload {
  userId: string;
  status: QueueStatus;
  queuedAt?: number;
}

export interface PresenceUpdatePayload {
  userId: string;
  username: string;
  status: PlayerStatus;
  timestamp: number;
}

// Matchmaking & Match Session Contracts (Safe - Never exposed credentials or hashes)

export interface MatchPlayerSummary {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  rating: number;
  status?: string;
  score?: number;
}

export interface MatchFoundPayload {
  matchId: string;
  players: MatchPlayerSummary[];
  status: MatchStatus;
  createdAt: number;
}

export interface MatchSessionDetails {
  id: string;
  status: MatchStatus;
  players: MatchPlayerSummary[];
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  winnerId?: string | null;
}

export interface QueueEntry {
  userId: string;
  socketId: string;
  username: string;
  displayName: string;
  avatar: string;
  rating: number;
  queuedAt: number;
}

export interface MatchmakingJoinResponse {
  status: QueueStatus;
  queuePosition?: number;
  matchId?: string;
  match?: MatchFoundPayload;
}

export interface MatchmakingError {
  status: 'error';
  code: 'ALREADY_QUEUED' | 'ALREADY_IN_MATCH' | 'NOT_AUTHENTICATED' | 'PLAYER_OFFLINE' | 'MATCHMAKING_FAILED';
  message: string;
}

// CyberGrid Real-Time Game Engine Contracts

export type NodeOwner = 'NEUTRAL' | 'PLAYER_1' | 'PLAYER_2';
export type NodeType = 'NORMAL' | 'SPECIAL';

export interface GridNode {
  id: string; // e.g. N00 - N44
  row: number; // 0 - 4
  col: number; // 0 - 4
  owner: NodeOwner;
  type: NodeType;
  value: number; // 100 for normal, 200 for special
  isDefended: boolean;
  defendedBy?: string | null;
}

export interface PlayerGameState {
  id: string;
  displayName: string;
  role: 'PLAYER_1' | 'PLAYER_2';
  rating: number;
  score: number;
  position: string; // Current Node ID (e.g. N00)
  status: string;
}

export interface FullGameState {
  matchId: string;
  version: number;
  status: MatchStatus;
  turnPlayerId: string;
  turnNumber: number;
  grid: Record<string, GridNode>;
  players: Record<string, PlayerGameState>;
  winnerId?: string | null;
  createdAt: number;
  updatedAt: number;
}

// Backwards-compatible GameState alias
export type GameState = FullGameState;

export type GameActionType = 'MOVE' | 'CAPTURE' | 'ATTACK' | 'DEFEND';

export interface GameActionPayload {
  matchId: string;
  actionId: string;
  type: GameActionType;
  targetNodeId?: string;
}

export interface ActionRejectedPayload {
  actionId: string;
  reason: string;
  code:
    | 'NOT_YOUR_TURN'
    | 'INVALID_MOVE'
    | 'INVALID_TARGET'
    | 'RATE_LIMITED'
    | 'DUPLICATE_ACTION'
    | 'GAME_NOT_ACTIVE'
    | 'UNAUTHORIZED';
}

export interface GameEventRecord {
  id: string;
  matchId: string;
  playerId: string | null;
  type: string;
  message: string;
  timestamp: number;
}

// ==========================================
// STAGE 6: COMPETITIVE PLATFORM CONTRACTS
// ==========================================

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  rating: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number; // percentage, e.g. 66.7
  currentWinStreak?: number;
  bestWinStreak?: number;
  totalScore?: number;
  bestScore?: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PlayerRankResponse {
  rank: number;
  rating: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
  currentWinStreak: number;
  bestWinStreak: number;
  totalScore: number;
  bestScore: number;
}

export interface MatchResultPlayer {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  score: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  isWinner: boolean;
}

export interface MatchResultDetails {
  matchId: string;
  status: MatchStatus;
  winnerId: string | null;
  winner?: MatchResultPlayer | null;
  players: MatchResultPlayer[];
  durationSeconds: number;
  startedAt: string;
  endedAt: string | null;
  finalVersion: number;
}

export interface MatchHistoryItem {
  matchId: string;
  result: 'VICTORY' | 'DEFEAT' | 'DRAW';
  myScore: number;
  opponentScore: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  opponent: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    rating: number;
  };
  durationSeconds: number;
  completedAt: string;
}

export interface MatchHistoryResponse {
  matches: MatchHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==========================================
// STAGE 7: OPERATIONS, MONITORING & SECURITY CONTRACTS
// ==========================================

export interface PlatformMetrics {
  activePlayers: number;
  activeMatches: number;
  matchmakingQueue: number;
  websocketConnections: number;
  totalConnectedUsers: number;
  eventsProcessed: number;
  eventsRejected: number;
  actionsProcessed: number;
  actionsRejected: number;
  matchesStarted: number;
  matchesCompleted: number;
  serverUptime: number; // in seconds
  timestamp: number;
  instanceLabel: string;
}

export interface PerformanceMetrics {
  averageActionLatency: number; // ms
  averageEventProcessingTime: number; // ms
  recentLatencySamples: number[];
  slowActions: number;
  errorCount: number;
  actionsPerSecond: number;
  eventsPerSecond: number;
}

export interface SystemHealthStatus {
  server: 'healthy' | 'degraded';
  database: 'healthy' | 'degraded';
  websocket: 'healthy' | 'degraded';
  matchmaking: 'healthy' | 'degraded';
}

export interface MonitoringMetricsResponse {
  platform: PlatformMetrics;
  performance: PerformanceMetrics;
  health: SystemHealthStatus;
  // Convenience top-level fields matching prompt specifications
  activePlayers: number;
  activeMatches: number;
  matchmakingQueue: number;
  websocketConnections: number;
  eventsProcessed: number;
  eventsRejected: number;
  actionsProcessed: number;
  actionsRejected: number;
  matchesStarted: number;
  matchesCompleted: number;
  averageActionLatency: number;
  serverUptime: number;
  errorCount: number;
  timestamp: number;
  instanceLabel: string;
}

export interface OperationalEvent {
  id: string;
  type: string;
  timestamp: number;
  matchId?: string | null;
  userId?: string | null;
  username?: string | null;
  duration?: number;
  success: boolean;
  reason?: string | null;
  metadata?: Record<string, any>;
}

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {
  id: string;
  type: string;
  severity: SecuritySeverity;
  userId?: string | null;
  username?: string | null;
  timestamp: number;
  context?: Record<string, any>;
}

export type AnomalyLevel = 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface AnomalyReport {
  userId: string;
  username?: string;
  score: number; // 0 - 100
  level: AnomalyLevel;
  factors: {
    actionFlooding: number;
    repeatedInvalidActions: number;
    impossibleActions: number;
    authFailures: number;
  };
  lastEvaluated: number;
}

export interface MonitoringEventsResponse {
  events: OperationalEvent[];
  total: number;
  bufferCapacity: number;
}

export interface MonitoringSecurityResponse {
  events: SecurityEvent[];
  total: number;
  bufferCapacity: number;
  anomalyReports: AnomalyReport[];
  summary: {
    lowCount: number;
    mediumCount: number;
    highCount: number;
    criticalCount: number;
    rateLimitViolations: number;
    unauthorizedRequests: number;
    suspiciousActivityCount: number;
  };
}
