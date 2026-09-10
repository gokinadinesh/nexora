import React, { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { matchmakingService } from '../../services/matchmaking.service';
import { QUEUE_STATUS } from '@nexora/shared';
import { DemoGuideModal } from '../UI/DemoGuideModal';
import { getApiUrl } from '../../services/api';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { isConnected } = useSocket();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const isLobby = location.pathname === '/lobby';
  const isProfile = location.pathname === '/profile';
  const isLeaderboard = location.pathname === '/leaderboard';
  const isHistory = location.pathname === '/history';
  const isMonitoring = location.pathname === '/monitoring';

  // Check if player is currently in an active match session
  useEffect(() => {
    if (isAuthenticated && !location.pathname.startsWith('/match/')) {
      matchmakingService
        .getStatus()
        .then((res: any) => {
          if (res.status === QUEUE_STATUS.MATCH_FOUND && res.matchId) {
            setActiveMatchId(res.matchId);
          } else {
            setActiveMatchId(null);
          }
        })
        .catch(() => {});
    } else {
      setActiveMatchId(null);
    }
  }, [isAuthenticated, location.pathname]);

  // Measure latency to server every 15s
  useEffect(() => {
    const measurePing = async () => {
      const start = Date.now();
      try {
        await fetch(getApiUrl('/api/health'));
        setLatencyMs(Date.now() - start);
      } catch {
        setLatencyMs(null);
      }
    };
    measurePing();
    const interval = setInterval(measurePing, 15000);
    return () => clearInterval(interval);
  }, []);


  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Active Match Banner */}
      {activeMatchId && !location.pathname.startsWith('/match/') && (
        <div
          style={{
            backgroundColor: 'rgba(255, 0, 85, 0.15)',
            borderBottom: '1px solid var(--accent-magenta)',
            boxShadow: 'var(--glow-magenta)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: '#ffffff',
            zIndex: 110,
          }}
        >
          <span className="indicator-dot pulse" style={{ color: 'var(--accent-magenta)' }} />
          <span>
            <strong>ACTIVE COMBAT SESSION IN PROGRESS</strong> // Match ID: {activeMatchId.slice(0, 8)}...
          </span>
          <Link
            to={`/match/${activeMatchId}`}
            className="btn-cyber-primary"
            style={{
              padding: '6px 16px',
              fontSize: '0.75rem',
              background: 'var(--accent-magenta)',
              borderColor: 'var(--accent-magenta)',
              color: '#ffffff',
            }}
          >
            RETURN TO GRID
          </Link>
        </div>
      )}

      {/* Top Cyber Navigation Bar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(6, 10, 23, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Brand & Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '2px solid var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--glow-cyan)',
              transform: 'rotate(45deg)',
              transition: 'transform 0.3s ease',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: 'var(--accent-cyan)',
              }}
            />
          </div>
          <div>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.45rem',
                fontWeight: 900,
                letterSpacing: '0.15em',
                color: 'var(--text-primary)',
              }}
            >
              NEX<span style={{ color: 'var(--accent-cyan)' }}>ORA</span>
            </span>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.62rem',
                letterSpacing: '0.2em',
                color: 'var(--text-muted)',
                marginTop: '-3px',
              }}
            >
              GRID_PROTOCOL // v0.9.0-DEMO
            </span>
          </div>
        </Link>

        {/* Live System Connectivity State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Socket & Latency Indicator */}
          <div
            className={`cyber-badge ${isConnected ? 'status-ok' : 'status-offline'}`}
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
          >
            <span className={`indicator-dot ${isConnected ? 'pulse' : ''}`} />
            <span>{isConnected ? 'GRID LINK: ONLINE' : 'GRID LINK: RECONNECTING'}</span>
            {latencyMs !== null && (
              <span style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '6px' }}>
                {latencyMs}ms
              </span>
            )}
          </div>

          {/* Demo Guide Launcher Button */}
          <button
            type="button"
            onClick={() => setIsDemoGuideOpen(true)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              letterSpacing: '0.1em',
              color: 'var(--accent-amber)',
              background: 'rgba(255, 183, 0, 0.08)',
              border: '1px solid rgba(255, 183, 0, 0.45)',
              borderRadius: '3px',
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>★</span>
            <span>DEMO GUIDE</span>
          </button>

          {/* Desktop Navigation Links */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isAuthenticated && user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link
                  to="/lobby"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.1em',
                    color: isLobby ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '2px',
                    borderBottom: isLobby ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  }}
                >
                  COMMAND
                </Link>
                <Link
                  to="/leaderboard"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.1em',
                    color: isLeaderboard ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '2px',
                    borderBottom: isLeaderboard ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  }}
                >
                  LEADERBOARD
                </Link>
                <Link
                  to="/history"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.1em',
                    color: isHistory ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '2px',
                    borderBottom: isHistory ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  }}
                >
                  HISTORY
                </Link>
                <Link
                  to="/profile"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.1em',
                    color: isProfile ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '2px',
                    borderBottom: isProfile ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  }}
                >
                  PROFILE
                </Link>

                {user.role === 'OPERATOR' && (
                  <Link
                    to="/monitoring"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.85rem',
                      letterSpacing: '0.1em',
                      color: isMonitoring ? 'var(--accent-cyan)' : '#00ff88',
                      textDecoration: 'none',
                      fontWeight: 700,
                      padding: '5px 12px',
                      borderRadius: '2px',
                      border: '1px solid rgba(0, 255, 136, 0.4)',
                      backgroundColor: 'rgba(0, 255, 136, 0.08)',
                    }}
                  >
                    OPERATIONS
                  </Link>
                )}

                <button
                  type="button"
                  onClick={logout}
                  className="btn-cyber-ghost"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link
                  to="/login"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.1em',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    padding: '8px 16px',
                    fontWeight: 600,
                  }}
                >
                  LOGIN
                </Link>
                <Link
                  to="/register"
                  className="btn-cyber-primary"
                  style={{ padding: '8px 18px', fontSize: '0.82rem' }}
                >
                  REGISTER
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {children}
      </main>

      {/* Footer Bar */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          backgroundColor: 'rgba(4, 7, 17, 0.95)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>NEXORA // SERVER-AUTHORITATIVE MULTIPLAYER CYBER-STRATEGY PLATFORM</div>
        <div>STAGE 9: DEMO-READY PRODUCT &amp; UX POLISH [BUILD VERIFIED]</div>
      </footer>

      {/* Demo Guide Modal */}
      <DemoGuideModal isOpen={isDemoGuideOpen} onClose={() => setIsDemoGuideOpen(false)} />
    </div>
  );
};
