import React, { useEffect, useState } from 'react';
import { LeaderboardEntry, LeaderboardResponse, PlayerRankResponse } from '@nexora/shared';
import { leaderboardService } from '../services/leaderboard.service';
import { useAuth } from '../hooks/useAuth';
import { CyberBadge, tierFromRating } from '../components/UI/CyberBadge';

export const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [myRank, setMyRank] = useState<PlayerRankResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  const fetchData = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const [lbData, rankData] = await Promise.all([
        leaderboardService.getLeaderboard(targetPage, limit),
        leaderboardService.getMyRank().catch(() => null),
      ]);
      setLeaderboard(lbData);
      setMyRank(rankData);
    } catch (err: any) {
      setError(err.message || 'Failed to load grid leaderboard telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page);
  }, [page]);

  const top3 = leaderboard?.entries.slice(0, 3) || [];

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) {
      return {
        background: 'rgba(255, 215, 0, 0.15)',
        border: '1px solid #ffd700',
        color: '#ffd700',
        boxShadow: '0 0 12px rgba(255, 215, 0, 0.5)',
      };
    }
    if (rank === 2) {
      return {
        background: 'rgba(192, 192, 192, 0.15)',
        border: '1px solid #c0c0c0',
        color: '#c0c0c0',
        boxShadow: '0 0 10px rgba(192, 192, 192, 0.4)',
      };
    }
    if (rank === 3) {
      return {
        background: 'rgba(205, 127, 50, 0.15)',
        border: '1px solid #cd7f32',
        color: '#cd7f32',
        boxShadow: '0 0 10px rgba(205, 127, 50, 0.4)',
      };
    }
    return {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-secondary)',
    };
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
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
            [GLOBAL NETWORK ARCHIVE // COMPETITIVE RANKINGS]
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
            GLOBAL ESPORTS LEADERBOARD
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CyberBadge type="status" value="ONLINE" label="RANK SYNCHRONIZED" />
          <button
            onClick={() => fetchData(page)}
            className="btn-cyber-primary"
            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
            disabled={loading}
          >
            {loading ? 'SYNCING...' : '⚡ REFRESH STANDINGS'}
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards (Only on Page 1) */}
      {page === 1 && top3.length >= 2 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: top3.length >= 3 ? '1fr 1.15fr 1fr' : '1fr 1.15fr',
            gap: '20px',
            alignItems: 'end',
            marginBottom: '32px',
          }}
        >
          {/* 2nd Place */}
          {top3[1] && (
            <div
              className="cyber-card"
              style={{
                padding: '24px',
                textAlign: 'center',
                border: '1px solid #c0c0c0',
                boxShadow: '0 0 15px rgba(192, 192, 192, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(192, 192, 192, 0.15)',
                  border: '2px solid #c0c0c0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c0c0c0',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 900,
                }}
              >
                #2
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {top3[1].displayName || top3[1].username}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                @{top3[1].username}
              </div>
              <CyberBadge type="rank" value={tierFromRating(top3[1].rating)} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                {top3[1].rating} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ELO</span>
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {top3[1].wins}W - {top3[1].losses}L ({top3[1].winRate}%)
              </div>
            </div>
          )}

          {/* 1st Place (Apex Operative) */}
          {top3[0] && (
            <div
              className="cyber-card"
              style={{
                padding: '32px 24px',
                textAlign: 'center',
                border: '2px solid #ffd700',
                boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                background: 'linear-gradient(180deg, rgba(255, 215, 0, 0.08) 0%, var(--bg-surface-elevated) 100%)',
              }}
            >
              <div
                style={{
                  padding: '2px 10px',
                  background: '#ffd700',
                  color: '#050811',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  borderRadius: '3px',
                  letterSpacing: '0.15em',
                }}
              >
                ★ GRAND CHAMPION ★
              </div>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(255, 215, 0, 0.2)',
                  border: '2px solid #ffd700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffd700',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)',
                }}
              >
                #1
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                {top3[0].displayName || top3[0].username}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                @{top3[0].username}
              </div>
              <CyberBadge type="rank" value={tierFromRating(top3[0].rating)} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, color: '#ffd700' }}>
                {top3[0].rating} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>ELO</span>
              </div>
              <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {top3[0].wins}W - {top3[0].losses}L ({top3[0].winRate}% Win Rate)
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div
              className="cyber-card"
              style={{
                padding: '24px',
                textAlign: 'center',
                border: '1px solid #cd7f32',
                boxShadow: '0 0 15px rgba(205, 127, 50, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(205, 127, 50, 0.15)',
                  border: '2px solid #cd7f32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#cd7f32',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 900,
                }}
              >
                #3
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {top3[2].displayName || top3[2].username}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                @{top3[2].username}
              </div>
              <CyberBadge type="rank" value={tierFromRating(top3[2].rating)} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
                {top3[2].rating} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ELO</span>
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {top3[2].wins}W - {top3[2].losses}L ({top3[2].winRate}%)
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Standing Card */}
      {myRank && (
        <div
          className="cyber-card"
          style={{
            padding: '20px 28px',
            marginBottom: '28px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.15)',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(5, 8, 17, 0.9) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '1.4rem',
                fontWeight: 900,
                ...getRankBadgeStyle(myRank.rank),
              }}
            >
              #{myRank.rank}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {user?.username}
                </span>
                <CyberBadge type="rank" value={tierFromRating(myRank.rating)} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                CURRENT COMPETITIVE STANDING
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>RATING</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {myRank.rating} ELO
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>WIN RATE</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: myRank.winRate >= 50 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                {myRank.winRate}%
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>RECORD (W - L)</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {myRank.wins} - {myRank.losses}
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>STREAK (CUR / BEST)</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                {myRank.currentWinStreak} / {myRank.bestWinStreak}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="cyber-alert cyber-alert-danger" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="cyber-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'rgba(0, 240, 255, 0.04)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.12em',
                }}
              >
                <th style={{ padding: '16px 20px', width: '80px' }}>RANK</th>
                <th style={{ padding: '16px 20px' }}>OPERATIVE</th>
                <th style={{ padding: '16px 20px' }}>TIER</th>
                <th style={{ padding: '16px 20px' }}>LEVEL</th>
                <th style={{ padding: '16px 20px' }}>RATING</th>
                <th style={{ padding: '16px 20px' }}>WIN RATE</th>
                <th style={{ padding: '16px 20px' }}>W / L</th>
                <th style={{ padding: '16px 20px' }}>MATCHES</th>
                <th style={{ padding: '16px 20px' }}>STREAK</th>
              </tr>
            </thead>
            <tbody>
              {loading && !leaderboard ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>
                      INTERROGATING GLOBAL RANK ARCHIVES...
                    </div>
                  </td>
                </tr>
              ) : leaderboard?.entries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>
                      NO OPERATIVE RANKINGS DETECTED ON THIS NETWORK SECTOR.
                    </div>
                  </td>
                </tr>
              ) : (
                leaderboard?.entries.map((entry: LeaderboardEntry) => {
                  const isCurrentUser = entry.id === user?.id;
                  const eTier = tierFromRating(entry.rating);

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: isCurrentUser ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: '16px 20px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            ...getRankBadgeStyle(entry.rank),
                          }}
                        >
                          #{entry.rank}
                        </div>
                      </td>

                      {/* Operative */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '4px',
                              background: 'rgba(0, 240, 255, 0.1)',
                              border: '1px solid var(--accent-cyan)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: 'var(--font-display)',
                              fontWeight: 900,
                              color: 'var(--accent-cyan)',
                            }}
                          >
                            {entry.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: isCurrentUser ? 'var(--accent-cyan)' : 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              {entry.displayName || entry.username}
                              {isCurrentUser && (
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.65rem',
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
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              @{entry.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tier */}
                      <td style={{ padding: '16px 20px' }}>
                        <CyberBadge type="rank" value={eTier} />
                      </td>

                      {/* Level */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            LVL {entry.level || 1}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {entry.milestoneTitle?.toUpperCase() || 'RECRUIT'}
                          </span>
                        </div>
                      </td>

                      {/* Rating */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                          {entry.rating}
                        </div>
                      </td>

                      {/* Win Rate */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              color: entry.winRate >= 50 ? 'var(--accent-green)' : 'var(--text-secondary)',
                            }}
                          >
                            {entry.winRate}%
                          </div>
                          <div
                            style={{
                              width: '60px',
                              height: '4px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, entry.winRate)}%`,
                                height: '100%',
                                background: entry.winRate >= 50 ? 'var(--accent-green)' : 'var(--accent-cyan)',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* W / L */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                          {entry.wins}W
                        </span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-red)' }}>
                          {entry.losses}L
                        </span>
                      </td>

                      {/* Matches */}
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                        {entry.matchesPlayed}
                      </td>

                      {/* Streak */}
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.9rem',
                            color: (entry.currentWinStreak || 0) > 0 ? 'var(--accent-amber)' : 'var(--text-muted)',
                            fontWeight: 700,
                          }}
                        >
                          {entry.currentWinStreak || 0}
                          {(entry.currentWinStreak || 0) >= 3 && ' 🔥'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {leaderboard && leaderboard.totalPages > 1 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ color: 'var(--text-muted)' }}>
              SHOWING PAGE {leaderboard.page} OF {leaderboard.totalPages} ({leaderboard.total} OPERATIVES)
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
                disabled={page >= leaderboard.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
