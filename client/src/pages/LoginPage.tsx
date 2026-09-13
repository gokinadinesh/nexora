import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const parseFirebaseError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      return 'Authentication failed: Invalid operative credentials';
    }
    if (code === 'auth/too-many-requests') {
      return 'Security lockdown: Too many failed attempts. Try again later.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in uplink cancelled';
    }
    return err?.message || 'Authentication failed: An unexpected error occurred';
  };

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
      setError(parseFirebaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/lobby');
    } catch (err: any) {
      setError(parseFirebaseError(err));
    } finally {
      setIsGoogleSubmitting(false);
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
                  background: 'none',
                  border: 'none',
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
              disabled={isSubmitting || isGoogleSubmitting}
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

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ padding: '0 12px' }}>OR CONNECT VIA</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting || isGoogleSubmitting}
          className="btn-cyber-ghost"
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            letterSpacing: '0.08em',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{isGoogleSubmitting ? 'CONNECTING GOOGLE UPLINK...' : 'CONTINUE WITH GOOGLE'}</span>
        </button>

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
