import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PlayerProfile } from '@nexora/shared';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { useSocket } from '../hooks/useSocket';
import { CyberBadge, tierFromRating } from '../components/UI/CyberBadge';

const AVATAR_OPTIONS = [
  { id: 'default_operative', name: 'Standard Operative', code: 'OP-0' },
  { id: 'cyber_vortex', name: 'Cyber Vortex', code: 'VX-1' },
  { id: 'neon_spectre', name: 'Neon Spectre', code: 'SP-2' },
  { id: 'grid_stalker', name: 'Grid Stalker', code: 'GS-3' },
  { id: 'quantum_core', name: 'Quantum Core', code: 'QC-4' },
];

export const ProfilePage: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { isConnected, socketId } = useSocket();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile Edit form state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editAvatar, setEditAvatar] = useState<string>('default_operative');
  const [saving, setSaving] = useState<boolean>(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isAuthenticated) {
      authService
        .getProfile()
        .then((data) => {
          setProfile(data);
          setEditDisplayName(data.displayName || data.username);
          setEditAvatar(data.avatar || 'default_operative');
          setLoadingProfile(false);
        })
        .catch((err) => {
          setError(err.message || 'Failed to load profile');
          setLoadingProfile(false);
        });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!editDisplayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        displayName: editDisplayName.trim(),
        avatar: editAvatar,
      });

      setProfile(updated);
      setIsEditing(false);
      setSuccessMessage('Operative profile updated successfully across the Grid');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingProfile) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cyber-badge status-ok pulse">
          <span className="indicator-dot" />
          <span>SYNCHRONIZING OPERATIVE TELEMETRY...</span>
        </div>
      </div>
    );
  }

  const myRating = profile?.rating ?? 1000;
  const rankTier = tierFromRating(myRating);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '36px 24px',
      }}
    >
      <div style={{ maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Header */}
        <div
          className="cyber-card"
          style={{
            padding: '32px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                background: 'var(--bg-surface-elevated)',
                border: '2px solid var(--accent-cyan)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--glow-cyan)',
                fontFamily: 'var(--font-display)',
                fontSize: '1.8rem',
                color: 'var(--accent-cyan)',
                fontWeight: 800,
              }}
            >
              {(profile?.displayName || user?.username || 'OP').slice(0, 2).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    letterSpacing: '0.2em',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  [AUTHORIZED OPERATIVE RECORD]
                </span>
                <CyberBadge type="rank" value={rankTier} />
              </div>
              <h1 style={{ fontSize: '2.2rem', letterSpacing: '0.08em', color: 'var(--text-primary)', margin: 0 }}>
                {profile?.displayName || user?.username}
              </h1>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                CALLSIGN: @{profile?.username} // LEVEL {profile?.level || 1} {profile?.milestoneTitle?.toUpperCase()} // EMAIL: {profile?.email}
              </p>
              
              {/* XP Progress Bar */}
              <div style={{ marginTop: '12px', maxWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>XP: {profile?.xp?.toLocaleString() || 0}</span>
                  <span>NEXT LEVEL: {(500 * Math.pow(profile?.level || 1, 2)).toLocaleString()} XP</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      background: 'var(--accent-cyan)', 
                      width: `${Math.min(100, Math.max(0, ((profile?.xp || 0) - (500 * Math.pow((profile?.level || 1) - 1, 2))) / ((500 * Math.pow(profile?.level || 1, 2)) - (500 * Math.pow((profile?.level || 1) - 1, 2))) * 100))}%`,
                      boxShadow: 'var(--glow-cyan)' 
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="btn-cyber-secondary"
            >
              {isEditing ? 'CANCEL EDIT' : 'EDIT DOSSIER'}
            </button>
            <button type="button" onClick={handleLogout} className="btn-cyber-danger">
              TERMINATE UPLINK
            </button>
          </div>
        </div>

        {error && (
          <div className="cyber-alert cyber-alert-danger" role="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="cyber-alert cyber-alert-success" role="status">
            <span>✔</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Profile Edit Interface (When Active) */}
        {isEditing && (
          <div className="cyber-card" style={{ padding: '28px' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                letterSpacing: '0.15em',
                color: 'var(--accent-cyan)',
                marginBottom: '18px',
              }}
            >
              [MODIFY OPERATIVE CREDENTIALS]
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="cyber-input-group">
                <label className="cyber-label" htmlFor="editDisplayName">
                  Operative Callsign / Display Name
                </label>
                <input
                  id="editDisplayName"
                  type="text"
                  className="cyber-input"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Tactical Callsign"
                  maxLength={30}
                  required
                />
              </div>

              <div className="cyber-input-group">
                <label className="cyber-label" htmlFor="editAvatar">
                  Avatar Designation
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '6px' }}>
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEditAvatar(opt.id)}
                      style={{
                        padding: '12px',
                        background: editAvatar === opt.id ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-surface-elevated)',
                        border: editAvatar === opt.id ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: editAvatar === opt.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-display)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{opt.code}</div>
                      <div style={{ fontWeight: 700, marginTop: '2px', fontSize: '0.9rem' }}>{opt.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn-cyber-primary" disabled={saving}>
                  {saving ? 'UPDATING...' : 'SAVE MODIFICATIONS'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-cyber-ghost"
                  disabled={saving}
                >
                  ABORT
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security Clearance & Identity Telemetry */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          <div className="cyber-card" style={{ padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              SECURITY CLEARANCE ROLE
            </div>
            <div style={{ marginTop: '8px' }}>
              <CyberBadge
                type="role"
                value={user?.role === 'OPERATOR' ? 'OPERATOR' : 'OPERATIVE'}
                label={user?.role === 'OPERATOR' ? 'OPERATOR (SYSTEM ROOT)' : 'OPERATIVE (LEVEL 1 GRID ACCESS)'}
              />
            </div>
          </div>

          <div className="cyber-card" style={{ padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              NODE REGISTRATION
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                marginTop: '8px',
              }}
            >
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : 'ONLINE'}
            </div>
          </div>

          <div className="cyber-card" style={{ padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              REAL-TIME SOCKET SESSION
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: isConnected ? 'var(--accent-green)' : 'var(--accent-red)',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className={`indicator-dot ${isConnected ? 'pulse' : ''}`} />
              <span>{isConnected ? `AUTHENTICATED (${socketId?.slice(0, 8)}...)` : 'DISCONNECTED'}</span>
            </div>
          </div>
        </div>

        {/* Competitive Record Area */}
        <div className="cyber-card" style={{ padding: '28px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                letterSpacing: '0.15em',
                color: 'var(--text-muted)',
              }}
            >
              [COMPETITIVE RECORD // AUTHORITATIVE TELEMETRY]
            </div>

            <CyberBadge type="rank" value={rankTier} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                GRID RATING
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--accent-cyan)', fontWeight: 800, marginTop: '4px' }}>
                {myRating} ELO
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                WIN RATE
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.7rem',
                  color: (profile?.winRate ?? 0) >= 50 ? 'var(--accent-green)' : 'var(--text-primary)',
                  fontWeight: 800,
                  marginTop: '4px',
                }}
              >
                {profile?.winRate ?? 0}%
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                W / L RECORD
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--text-primary)', fontWeight: 800, marginTop: '4px' }}>
                <span style={{ color: 'var(--accent-green)' }}>{profile?.wins ?? 0}</span>
                <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                <span style={{ color: 'var(--accent-red)' }}>{profile?.losses ?? 0}</span>
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                WIN STREAK
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--accent-amber)', fontWeight: 800, marginTop: '4px' }}>
                {profile?.currentWinStreak ?? 0}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                  (MAX {profile?.bestWinStreak ?? 0})
                </span>
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                TOTAL SCORE
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--text-primary)', fontWeight: 800, marginTop: '4px' }}>
                {(profile?.totalScore ?? 0).toLocaleString()}
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                BEST SCORE
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--accent-cyan)', fontWeight: 800, marginTop: '4px' }}>
                {(profile?.bestScore ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <Link to="/lobby" className="btn-cyber-primary" style={{ textDecoration: 'none', padding: '12px 24px' }}>
              ENTER COMMAND LOBBY
            </Link>
            <Link to="/history" className="btn-cyber-secondary" style={{ textDecoration: 'none', padding: '12px 20px' }}>
              COMBAT ARCHIVES
            </Link>
            <Link to="/leaderboard" className="btn-cyber-secondary" style={{ textDecoration: 'none', padding: '12px 20px' }}>
              GLOBAL LEADERBOARD
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
