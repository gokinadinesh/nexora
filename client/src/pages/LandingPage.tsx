import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HealthResponse } from '@nexora/shared';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { CyberGridPreview } from '../components/UI/CyberGridPreview';

export const LandingPage: React.FC = () => {
  const { isConnected } = useSocket();
  const { isAuthenticated, user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: HealthResponse) => {
        setHealth(data);
        setLoadingHealth(false);
      })
      .catch(() => {
        setHealth(null);
        setLoadingHealth(false);
      });
  }, []);

  const handlePlayClick = () => {
    if (isAuthenticated) {
      navigate('/lobby');
    } else {
      navigate('/register');
    }
  };

  const PILLARS = [
    {
      icon: '⚡',
      title: 'Real-Time Multiplayer',
      description: 'Sub-second bidirectional synchronization powered by Socket.IO, room-based multicasting, and resilient disconnect recovery.',
      badge: 'LOW LATENCY',
    },
    {
      icon: '🎯',
      title: 'Intelligent Matchmaking',
      description: 'Dynamic rating-aware FIFO queue that progressively widens ELO tolerance windows to guarantee fast, competitive pairings.',
      badge: 'DYNAMIC ELO',
    },
    {
      icon: '🛡',
      title: 'Server-Authoritative Engine',
      description: 'Deterministic 5×5 CyberGrid simulation. Moves, captures, firewall shields, and turns are validated strictly on the backend.',
      badge: 'ANTI-CHEAT',
    },
    {
      icon: '📊',
      title: 'Competitive Operations',
      description: 'Full audit trails, tamper-proof ELO progression, leaderboards, and an operator telemetry dashboard with anomaly detection.',
      badge: 'OBSERVABLE',
    },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 64px',
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        gap: '48px',
      }}
    >
      {/* Hero Section */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px',
          maxWidth: '920px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            letterSpacing: '0.25em',
            color: 'var(--accent-cyan)',
            padding: '5px 16px',
            border: '1px solid var(--border-glow)',
            backgroundColor: 'rgba(0, 240, 255, 0.05)',
            borderRadius: '3px',
          }}
        >
          <span className="indicator-dot pulse" style={{ color: 'var(--accent-cyan)' }} />
          <span>CYBER-STRATEGY MULTIPLAYER ENGINE // PROTOCOL v0.9</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(3.8rem, 8vw, 6.2rem)',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '0.14em',
            color: 'var(--text-primary)',
            textShadow: '0 0 40px rgba(0, 240, 255, 0.5)',
            margin: '8px 0',
          }}
        >
          NEX<span style={{ color: 'var(--accent-cyan)' }}>ORA</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(1.3rem, 2.5vw, 1.85rem)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            lineHeight: 1.3,
          }}
        >
          Enter the Grid. Outsmart the Network.
        </p>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            maxWidth: '680px',
            lineHeight: 1.6,
            marginTop: '-4px',
          }}
        >
          Real-time multiplayer cyber strategy powered by server-authoritative game infrastructure, deterministic 5×5 grid simulation, and cryptographic telemetry.
        </p>

        {/* Primary Call to Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn-cyber-primary"
            onClick={handlePlayClick}
            style={{ fontSize: '1.05rem', padding: '16px 42px' }}
          >
            <span>{isAuthenticated ? `ENTER LOBBY [@${user?.username}]` : 'PLAY NEXORA'}</span>
            <span>➔</span>
          </button>

          <Link
            to="/leaderboard"
            className="btn-cyber-secondary"
            style={{ fontSize: '0.95rem', padding: '15px 28px' }}
          >
            VIEW LEADERBOARD
          </Link>
        </div>
      </section>

      {/* Interactive CyberGrid Preview Widget */}
      <section style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)', letterSpacing: '0.15em' }}>
            [INTERACTIVE BATTLE DEMO]
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            Click nodes below to test live capture mechanics
          </div>
        </div>
        <CyberGridPreview />
      </section>

      {/* 4 Infrastructure Pillars */}
      <section style={{ width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)', letterSpacing: '0.18em' }}>
            [CORE TECHNICAL PILLARS]
          </div>
          <h2 style={{ fontSize: '1.8rem', letterSpacing: '0.06em', color: 'var(--text-primary)', marginTop: '4px' }}>
            ENGINEERED FOR SERIOUS MULTIPLAYER
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
            width: '100%',
          }}
        >
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="cyber-card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--accent-cyan)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.8rem' }}>{pillar.icon}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: 'var(--accent-cyan)',
                      background: 'rgba(0, 240, 255, 0.08)',
                      padding: '3px 8px',
                      borderRadius: '2px',
                      border: '1px solid rgba(0, 240, 255, 0.25)',
                    }}
                  >
                    {pillar.badge}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.15rem',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                    letterSpacing: '0.05em',
                  }}
                >
                  {pillar.title}
                </h3>

                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.98rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Infrastructure Telemetry Strip */}
      <section
        className="cyber-card"
        style={{
          width: '100%',
          padding: '20px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
          background: 'rgba(10, 18, 38, 0.85)',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            SERVER HEALTH
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.95rem',
              color: health?.status === 'ok' ? 'var(--text-success)' : 'var(--text-danger)',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            {loadingHealth ? 'PROBING...' : health ? `${health.service} [${health.status}]` : 'OFFLINE'}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            SOCKET UPLINK
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.95rem',
              color: isConnected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            {isConnected ? 'ESTABLISHED (WSS)' : 'DISCONNECTED'}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            DATABASE ENGINE
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.95rem',
              color: health?.services?.database === 'healthy' ? 'var(--text-success)' : 'var(--text-warning)',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            POSTGRESQL // {health?.services?.database?.toUpperCase() || 'READY'}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            GRID VALIDATION
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.95rem',
              color: 'var(--accent-green)',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            SERVER-AUTHORITATIVE
          </div>
        </div>
      </section>
    </div>
  );
};
