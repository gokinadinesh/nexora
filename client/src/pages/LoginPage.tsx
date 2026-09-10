import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message || 'Authentication failed: Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <div className="cyber-card cyber-card-glow" style={{ maxWidth: '460px', width: '100%', padding: '36px 32px' }}>
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.2em',
              color: 'var(--accent-cyan)',
              marginBottom: '8px',
            }}
          >
            [SYSTEM AUTHENTICATION]
          </div>
          <h2 style={{ fontSize: '1.9rem', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            ACCESS THE GRID
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Enter credentials to establish encrypted operative session
          </p>
        </div>

        {error && (
          <div className="cyber-alert cyber-alert-danger" role="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="cyber-input-group">
            <label className="cyber-label" htmlFor="email">
              <span>Operative Email</span>
              <span style={{ color: 'var(--text-muted)' }}>REQUIRED</span>
            </label>
            <input
              id="email"
              type="email"
              className="cyber-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operative@nexora.io"
              autoComplete="email"
              required
            />
          </div>

          <div className="cyber-input-group">
            <label className="cyber-label" htmlFor="password">
              <span>Access Key (Password)</span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  color: 'var(--accent-cyan)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? '[HIDE KEY]' : '[SHOW KEY]'}
              </button>
            </label>
            <div className="cyber-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="cyber-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <div style={{ marginTop: '28px' }}>
            <button
              type="submit"
              className="btn-cyber-primary"
              style={{ width: '100%', padding: '14px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="indicator-dot pulse" />
                  <span>AUTHENTICATING ENCRYPTED UPLINK...</span>
                </>
              ) : (
                <span>ENTER COMMAND LOBBY ➔</span>
              )}
            </button>
          </div>
        </form>

        {/* Demo Quick-Fill Presets for Presentation */}
        <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.12em',
              marginBottom: '10px',
              textAlign: 'center',
            }}
          >
            QUICK PRESENTATION PRESETS:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fillCredentials('operator@nexora.io', 'Password123!')}
              className="btn-cyber-ghost"
              style={{
                border: '1px solid var(--border-subtle)',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                padding: '6px 8px',
              }}
            >
              OPERATOR ROLE
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('player_one@nexora.io', 'Password123!')}
              className="btn-cyber-ghost"
              style={{
                border: '1px solid var(--border-subtle)',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                padding: '6px 8px',
              }}
            >
              PLAYER 1 (OP-01)
            </button>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          New operative to the network?{' '}
          <Link to="/register" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700 }}>
            Register Identity
          </Link>
        </div>
      </div>
    </div>
  );
};
