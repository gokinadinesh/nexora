import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MatchHistoryItem, MatchHistoryResponse } from '@nexora/shared';
import { matchService } from '../services/match.service';
import { CyberBadge, tierFromRating } from '../components/UI/CyberBadge';

export const MatchHistoryPage: React.FC = () => {
  const [history, setHistory] = useState<MatchHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  const fetchHistory = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await matchService.getHistory(targetPage, limit);
      setHistory(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve match logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page);
  }, [page]);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '< 1s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Header Banner */}
      <div
        className="cyber-card"
        style={{
          padding: '24px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--accent-cyan)',
              letterSpacing: '0.2em',
              marginBottom: '4px',
            }}
          >
            [COMBAT AUDIT ARCHIVE // RECENT ENGAGEMENTS]
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.2rem',
              letterSpacing: '0.08em',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            ENGAGEMENT HISTORY
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/lobby" className="btn-cyber-primary" style={{ padding: '8px 18px', fontSize: '0.85rem', textDecoration: 'none' }}>
            ⚡ NEW MATCH
          </Link>
          <button
            onClick={() => fetchHistory(page)}
            className="btn-cyber-ghost"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            disabled={loading}
          >
            {loading ? 'SYNCING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="cyber-alert cyber-alert-danger" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Match Cards List */}
      {loading && !history ? (
        <div
          className="cyber-card"
          style={{
            padding: '60px',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
          }}
        >
          DECRYPTING COMBAT ARCHIVES FROM NETWORK STORE...
        </div>
      ) : history?.matches.length === 0 ? (
        <div
          className="cyber-card"
          style={{
            padding: '60px 40px',
            textAlign: 'center',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.4rem',
              color: 'var(--text-primary)',
              marginBottom: '12px',
            }}
          >
            NO COMBAT ENGAGEMENTS RECORDED
          </div>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginBottom: '24px',
            }}
          >
            Your operative record is clear. Enter the CyberGrid queue to establish competitive telemetry.
          </p>
          <Link to="/lobby" className="btn-cyber-primary" style={{ padding: '12px 28px', textDecoration: 'none', display: 'inline-block' }}>
            ENTER MATCHMAKING LOBBY
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {history?.matches.map((match: MatchHistoryItem) => {
            const isVictory = match.result === 'VICTORY';
            const isDefeat = match.result === 'DEFEAT';

            const borderColor = isVictory
              ? 'var(--accent-green)'
              : isDefeat
              ? 'var(--accent-red)'
              : 'var(--accent-amber)';

            const glow = isVictory
              ? '0 0 15px rgba(0, 255, 136, 0.15)'
              : isDefeat
              ? '0 0 15px rgba(255, 68, 68, 0.15)'
              : 'none';

            const oppTier = tierFromRating(match.opponent.rating || 1000);

            return (
              <div
                key={match.matchId}
                className="cyber-card"
                style={{
                  borderLeft: `4px solid ${borderColor}`,
                  boxShadow: glow,
                  padding: '20px 24px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  transition: 'transform 0.15s ease',
                }}
              >
                {/* Result Indicator & Opponent */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: '300px' }}>
                  <div
                    style={{
                      width: '96px',
                      padding: '8px 0',
                      textAlign: 'center',
                      background: isVictory ? 'rgba(0, 255, 136, 0.15)' : isDefeat ? 'rgba(255, 68, 68, 0.15)' : 'rgba(255, 183, 0, 0.15)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '4px',
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.9rem',
                      fontWeight: 900,
                      letterSpacing: '0.1em',
                      color: borderColor,
                    }}
                  >
                    {match.result}
                  </div>

                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.12em',
                      }}
                    >
                      VS OPPONENT
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {match.opponent.displayName || match.opponent.username}
                      </span>
                      <CyberBadge type="rank" value={oppTier} />
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      @{match.opponent.username} // {match.opponent.rating} ELO
                    </div>
                  </div>
                </div>

                {/* Score & Rating Change */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                      }}
                    >
                      SCORE
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        textAlign: 'center',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span style={{ color: isVictory ? 'var(--accent-green)' : 'inherit' }}>{match.myScore}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>:</span>
                      <span style={{ color: isDefeat ? 'var(--accent-red)' : 'inherit' }}>{match.opponentScore}</span>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                      }}
                    >
                      RATING DELTA
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        textAlign: 'center',
                        color: match.ratingChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}
                    >
                      {match.ratingChange > 0 ? `+${match.ratingChange}` : match.ratingChange}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginLeft: '6px',
                          fontWeight: 400,
                        }}
                      >
                        ({match.ratingAfter})
                      </span>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textAlign: 'right',
                      }}
                    >
                      TIMESTAMP
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        textAlign: 'right',
                      }}
                    >
                      {formatDate(match.completedAt)}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        textAlign: 'right',
                      }}
                    >
                      DURATION: {formatDuration(match.durationSeconds)}
                    </div>
                  </div>
                </div>

                {/* Match Inspect & Replay CTAs */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Link
                    to={`/replay/${match.matchId}`}
                    className="btn-cyber-primary"
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>▶</span> REPLAY
                  </Link>
                  <Link
                    to={`/match/${match.matchId}`}
                    className="btn-cyber-secondary"
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    INSPECT →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {history && history.totalPages > 1 && (
        <div
          className="cyber-card"
          style={{
            marginTop: '28px',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ color: 'var(--text-muted)' }}>
            PAGE {history.page} OF {history.totalPages} // TOTAL {history.total} ENGAGEMENTS
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-cyber-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              PREVIOUS
            </button>
            <button
              className="btn-cyber-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              disabled={page >= history.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              NEXT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
