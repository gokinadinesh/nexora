import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GAME_EVENTS,
  LobbyPlayer,
  LobbyResponse,
  PlayerProfile,
  MatchFoundPayload,
  QUEUE_STATUS,
} from '@nexora/shared';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { authService } from '../services/auth.service';
import { lobbyService } from '../services/lobby.service';
import { matchmakingService } from '../services/matchmaking.service';
import { getSocket } from '../services/socket';
import { CyberBadge, tierFromRating } from '../components/UI/CyberBadge';

export const LobbyPage: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isConnected, socketId } = useSocket();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [lobbyData, setLobbyData] = useState<LobbyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Matchmaking State
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [queueTimer, setQueueTimer] = useState<number>(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [matchFound, setMatchFound] = useState<MatchFoundPayload | null>(null);
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const [autoLaunchCountdown, setAutoLaunchCountdown] = useState<number>(5);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLobby = useCallback(async () => {
    try {
      const data = await lobbyService.getLobby();
      setLobbyData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh lobby data');
    }
  }, []);

  // Timer for queue duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSearching) {
      interval = setInterval(() => {
        setQueueTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setQueueTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching]);

  // Auto-launch countdown when match is found
  useEffect(() => {
    if (matchFound) {
      setAutoLaunchCountdown(4);
      countdownRef.current = setInterval(() => {
        setAutoLaunchCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            navigate(`/match/${matchFound.matchId}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [matchFound, navigate]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isAuthenticated) {
      Promise.all([
        authService.getProfile(),
        lobbyService.getLobby(),
        matchmakingService.getStatus(),
      ])
        .then(([profileRes, lobbyRes, statusRes]) => {
          setProfile(profileRes);
          setLobbyData(lobbyRes);
          if (statusRes.status === QUEUE_STATUS.QUEUED) {
            setIsSearching(true);
            setQueuePosition(statusRes.queuePosition || 1);
          }
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Failed to synchronize with lobby command');
          setLoading(false);
        });

      // Real-time socket event listeners
      const socket = getSocket();

      const handlePresenceChange = () => {
        fetchLobby();
      };

      const handleMatchFound = (payload: MatchFoundPayload) => {
        setIsSearching(false);
        setMatchFound(payload);
      };

      const handleQueueStatus = (payload: any) => {
        if (payload?.status === QUEUE_STATUS.QUEUED) {
          setIsSearching(true);
          if (payload.queuePosition) setQueuePosition(payload.queuePosition);
        } else if (payload?.status === QUEUE_STATUS.NOT_QUEUED) {
          setIsSearching(false);
          if (payload.error) {
            setMatchmakingError(payload.error);
          }
        }
      };

      socket.on(GAME_EVENTS.PLAYER_ONLINE, handlePresenceChange);
      socket.on(GAME_EVENTS.PLAYER_OFFLINE, handlePresenceChange);
      socket.on(GAME_EVENTS.PLAYER_STATUS_CHANGED, handlePresenceChange);
      socket.on(GAME_EVENTS.MATCH_FOUND, handleMatchFound);
      socket.on(GAME_EVENTS.QUEUE_STATUS, handleQueueStatus);

      return () => {
        socket.off(GAME_EVENTS.PLAYER_ONLINE, handlePresenceChange);
        socket.off(GAME_EVENTS.PLAYER_OFFLINE, handlePresenceChange);
        socket.off(GAME_EVENTS.PLAYER_STATUS_CHANGED, handlePresenceChange);
        socket.off(GAME_EVENTS.MATCH_FOUND, handleMatchFound);
        socket.off(GAME_EVENTS.QUEUE_STATUS, handleQueueStatus);
      };
    }
  }, [isAuthenticated, isLoading, navigate, fetchLobby]);

  const handleStartMatchmaking = async () => {
    setMatchmakingError(null);
    try {
      const socket = getSocket();
      const sId = socketId || socket.id;

      const response = await matchmakingService.joinQueue(sId);
      if (response.status === QUEUE_STATUS.MATCH_FOUND && response.match) {
        setIsSearching(false);
        setMatchFound(response.match);
      } else {
        setIsSearching(true);
        setQueuePosition(response.queuePosition || 1);
      }
    } catch (err: any) {
      setMatchmakingError(err.message || 'Failed to enter matchmaking queue');
      setIsSearching(false);
    }
  };

  const handleCancelMatchmaking = async () => {
    try {
      await matchmakingService.leaveQueue();
      setIsSearching(false);
      setQueuePosition(null);
    } catch (err: any) {
      setMatchmakingError(err.message || 'Failed to leave queue');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading || loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cyber-badge status-ok pulse">
          <span className="indicator-dot" />
          <span>SYNCHRONIZING WITH NEXORA COMMAND LOBBY...</span>
        </div>
      </div>
    );
  }

  const myRating = profile?.rating ?? 1000;
  const rankTier = tierFromRating(myRating);
  const players = lobbyData?.players || [];
  const playersOnlineCount = lobbyData?.playersOnline ?? players.length;
  const matchesTotal = profile?.matchesPlayed ?? 0;
  const winsTotal = profile?.wins ?? 0;
  const winRate = matchesTotal > 0 ? Math.round((winsTotal / matchesTotal) * 100) : 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px',
        maxWidth: '1240px',
        width: '100%',
        margin: '0 auto',
        gap: '24px',
      }}
    >
      {/* Top Banner: Command Center Header */}
      <div
        className="cyber-card"
        style={{
          padding: '24px 32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.2em',
              color: 'var(--accent-cyan)',
              marginBottom: '4px',
            }}
          >
            [COMMAND SECTOR 01 // COMPETITIVE MULTIPLAYER LOBBY]
          </div>
          <h1 style={{ fontSize: '2rem', letterSpacing: '0.08em', color: 'var(--text-primary)', margin: 0 }}>
            NEXORA COMMAND CENTER
          </h1>
        </div>

        {/* Telemetry status indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <CyberBadge type="status" value="ONLINE" label="GRID SYSTEM ONLINE" />
          <div className={`cyber-badge ${isConnected ? 'status-ok' : 'status-offline'}`}>
            <span className={`indicator-dot ${isConnected ? 'pulse' : ''}`} />
            <span>SOCKET: {isConnected ? `CONNECTED (${socketId?.slice(0, 6) || 'AUTH'})` : 'DISCONNECTED'}</span>
          </div>
          <button
            type="button"
            onClick={fetchLobby}
            className="btn-cyber-ghost"
            style={{ padding: '6px 14px', fontSize: '0.75rem' }}
            title="Refresh lobby operatives list"
          >
            REFRESH ROSTER
          </button>
        </div>
      </div>

      {(error || matchmakingError) && (
        <div className="cyber-alert cyber-alert-danger" role="alert">
          <span>⚠</span>
          <span>{error || matchmakingError}</span>
        </div>
      )}

      {/* Main Grid: Operative Identity & Matchmaking Command */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Operative Dossier Card */}
        <div className="cyber-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              OPERATIVE PROFILE DOSSIER
            </span>
            <CyberBadge type="rank" value={rankTier} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                background: 'var(--bg-surface-elevated)',
                border: '2px solid var(--accent-cyan)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--glow-cyan)',
                fontFamily: 'var(--font-display)',
                fontSize: '1.6rem',
                color: 'var(--accent-cyan)',
                fontWeight: 800,
              }}
            >
              {(profile?.displayName || user?.username || 'OP').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {profile?.displayName || user?.username}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                CALLSIGN: @{profile?.username || user?.username}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                SECURITY CLEARANCE: {user?.role === 'OPERATOR' ? 'OPERATOR (ROOT)' : 'OPERATIVE (LEVEL 1)'}
              </div>
            </div>
          </div>

          {/* Identity Stats Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>RATING</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--accent-cyan)', fontWeight: 700, marginTop: '2px' }}>
                {myRating}
              </div>
            </div>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>MATCHES</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>
                {matchesTotal}
              </div>
            </div>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>WINS / LOSS</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--accent-green)', fontWeight: 700, marginTop: '2px' }}>
                {winsTotal}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/{profile?.losses ?? 0}</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>WIN RATE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: winRate >= 50 ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontWeight: 700, marginTop: '2px' }}>
                {winRate}%
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Matchmaking Command Console */}
        <div className="cyber-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                GRID TELEMETRY & MATCH FINDER
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                [BRACKET ±150 ELO]
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>OPERATIVES ONLINE</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--accent-green)', marginTop: '4px', fontWeight: 700 }}>
                  {playersOnlineCount}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>QUEUE STATUS</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: isSearching ? 'var(--accent-amber)' : 'var(--text-secondary)', marginTop: '4px', fontWeight: 700 }}>
                  {isSearching ? 'ACTIVE' : 'STANDBY'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>ESTIMATED WAIT</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--accent-cyan)', marginTop: '4px', fontWeight: 700 }}>
                  &lt; 5s
                </div>
              </div>
            </div>
          </div>

          {/* Matchmaking Action / Radar Sweep Console */}
          {isSearching ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '20px',
                background: 'rgba(255, 184, 0, 0.04)',
                border: '1px solid var(--accent-amber)',
                borderRadius: '6px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Radar sweep indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 184, 0, 0.4)',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'radial-gradient(circle, rgba(255,184,0,0.15) 0%, transparent 70%)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      borderTop: '2px solid var(--accent-amber)',
                      animation: 'radarSweep 2s linear infinite',
                    }}
                  />
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--accent-amber)',
                      boxShadow: '0 0 10px var(--accent-amber)',
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
                      SCANNING MATCHMAKING QUEUE...
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                      [{formatTime(queueTimer)}]
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      QUEUE POSITION: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>#{queuePosition || 1}</span>
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      BRACKET: {myRating - 150} - {myRating + 150} ELO
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelMatchmaking}
                className="btn-cyber-danger"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '0.85rem',
                }}
              >
                CANCEL MATCH SEARCH
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleStartMatchmaking}
                className="btn-cyber-primary"
                style={{
                  width: '100%',
                  padding: '18px 24px',
                  fontSize: '1.1rem',
                  letterSpacing: '0.15em',
                  boxShadow: '0 0 20px rgba(0, 240, 255, 0.35)',
                }}
              >
                ⚡ FIND MATCH
              </button>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--accent-cyan)',
                  textAlign: 'center',
                  letterSpacing: '0.08em',
                }}
              >
                [AUTO-MATCH WITH RATING-COMPATIBLE OPPONENTS VIA SOCKET.IO]
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match Found Modal Overlay with Countdown Launch */}
      {matchFound && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 17, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div
            className="cyber-card"
            style={{
              maxWidth: '680px',
              width: '100%',
              padding: '36px',
              border: '2px solid var(--accent-cyan)',
              boxShadow: '0 0 30px rgba(0, 240, 255, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <div>
              <div className="cyber-badge status-ok pulse" style={{ marginBottom: '12px' }}>
                <span className="indicator-dot" />
                <span>SERVER-AUTHORITATIVE MATCH GENERATED</span>
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.2rem',
                  letterSpacing: '0.12em',
                  color: 'var(--text-primary)',
                  margin: '4px 0',
                }}
              >
                MATCH READY
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                SESSION ID: <span style={{ color: 'var(--accent-cyan)' }}>{matchFound.matchId}</span>
              </div>
            </div>

            {/* Matchup Head-to-Head Comparison Card */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '16px',
                background: 'var(--bg-surface-elevated)',
                padding: '24px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Player 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    background: 'var(--bg-surface)',
                    border: '2px solid var(--accent-cyan)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.4rem',
                    color: 'var(--accent-cyan)',
                    fontWeight: 800,
                  }}
                >
                  {(matchFound.players[0]?.displayName || 'OP').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  {matchFound.players[0]?.displayName}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  RATING {matchFound.players[0]?.rating}
                </div>
                <CyberBadge type="rank" value={tierFromRating(matchFound.players[0]?.rating || 1000)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2rem',
                    color: 'var(--accent-amber)',
                    fontWeight: 900,
                    textShadow: '0 0 10px rgba(255, 184, 0, 0.6)',
                  }}
                >
                  VS
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  5×5 GRID
                </div>
              </div>

              {/* Player 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    background: 'var(--bg-surface)',
                    border: '2px solid var(--accent-magenta)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.4rem',
                    color: 'var(--accent-magenta)',
                    fontWeight: 800,
                  }}
                >
                  {(matchFound.players[1]?.displayName || 'OP').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  {matchFound.players[1]?.displayName}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-magenta)' }}>
                  RATING {matchFound.players[1]?.rating}
                </div>
                <CyberBadge type="rank" value={tierFromRating(matchFound.players[1]?.rating || 1000)} />
              </div>
            </div>

            {/* Countdown and Enter Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => navigate(`/match/${matchFound.matchId}`)}
                className="btn-cyber-primary"
                style={{
                  width: '100%',
                  padding: '18px 24px',
                  fontSize: '1.15rem',
                  letterSpacing: '0.15em',
                  boxShadow: '0 0 25px rgba(0, 240, 255, 0.5)',
                }}
              >
                ENTER BATTLE GRID NOW ({autoLaunchCountdown}s) →
              </button>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auto-connecting operative sockets to session room...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Online Operatives Roster */}
      <div className="cyber-card" style={{ padding: '28px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '14px',
          }}
        >
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              ONLINE OPERATIVES DIRECTORY
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)', marginLeft: '10px' }}>
              [{players.length} DETECTED]
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            REAL-TIME PRESENCE BROADCAST
          </span>
        </div>

        {players.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            NO OTHER OPERATIVES CURRENTLY TRANSMITTING ON THIS GRID
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '16px',
            }}
          >
            {players.map((p: LobbyPlayer) => {
              const isMe = p.id === user?.id;
              const pTier = tierFromRating(p.rating);

              return (
                <div
                  key={p.id}
                  style={{
                    padding: '16px',
                    background: isMe ? 'rgba(0, 240, 255, 0.06)' : 'var(--bg-surface-elevated)',
                    border: isMe ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                    boxShadow: isMe ? '0 0 15px rgba(0, 240, 255, 0.2)' : 'none',
                  }}
                >
                  {isMe && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        fontSize: '0.65rem',
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        background: 'var(--accent-cyan)',
                        color: '#050811',
                        fontWeight: 800,
                        borderRadius: '2px',
                      }}
                    >
                      YOU
                    </span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        color: isMe ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        fontWeight: 700,
                      }}
                    >
                      {p.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {p.displayName}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{p.username}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '2px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <CyberBadge type="rank" value={pTier} />
                    <CyberBadge
                      type="status"
                      value={p.status === 'IN_MATCH' ? 'IN_COMBAT' : p.status === 'QUEUED' ? 'QUEUED' : 'ONLINE'}
                      label={p.status}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
