import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: 'NONE', color: 'var(--text-muted)' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: 'WEAK', color: 'var(--accent-red)' };
    if (score === 2) return { score: 2, label: 'MODERATE', color: 'var(--accent-amber)' };
    if (score === 3) return { score: 3, label: 'SECURE', color: 'var(--accent-cyan)' };
    return { score: 4, label: 'MAXIMUM', color: 'var(--accent-green)' };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername || !cleanEmail || !password || !confirmPassword) {
      setError('All security parameters are required');
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError('Operative callsign must be between 3 and 20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError('Callsign may only contain letters, numbers, and underscores');
      return;
    }

    if (password.length < 8) {
      setError('Security key must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Security key confirmation mismatch');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        username: cleanUsername,
        email: cleanEmail,
        password,
      });
      // Direct competitive onboarding directly into the Lobby command center
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message || 'Registration failed - check network status');
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="cyber-card" style={{ maxWidth: '480px', width: '100%', padding: '36px 32px' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.2em',
              color: 'var(--accent-cyan)',
              marginBottom: '8px',
            }}
          >
            [NEW OPERATIVE ENROLLMENT]
          </div>
          <h2 style={{ fontSize: '1.8rem', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            REGISTER IDENTITY
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Provision cryptographic credentials for grid access
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
            <label className="cyber-label" htmlFor="username">
              Operative Callsign (Username)
            </label>
            <input
              id="username"
              type="text"
              className="cyber-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Cipher_Zero"
              autoComplete="username"
              maxLength={20}
              required
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Letters, numbers, underscores only (3–20 chars)
            </div>
          </div>

          <div className="cyber-input-group">
            <label className="cyber-label" htmlFor="email">
              Network Email Address
            </label>
            <input
              id="email"
              type="email"
              className="cyber-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operative@nexora.net"
              autoComplete="email"
              required
            />
          </div>

          <div className="cyber-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="cyber-label" htmlFor="password" style={{ marginBottom: 0 }}>
                Security Key (Min 8 chars)
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                {showPassword ? 'HIDE KEY' : 'REVEAL KEY'}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="cyber-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              style={{ marginTop: '6px' }}
              required
            />
            {password.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ENCRYPTION STRENGTH:</span>
                  <span style={{ color: strength.color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {strength.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px', height: '4px' }}>
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        background: step <= strength.score ? strength.color : 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '2px',
                        transition: 'background 0.3s ease',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="cyber-input-group">
            <label className="cyber-label" htmlFor="confirmPassword">
              Confirm Security Key
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              className="cyber-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '4px' }}>
                ✖ Keys do not match
              </div>
            )}
            {confirmPassword.length > 0 && password === confirmPassword && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '4px' }}>
                ✔ Cryptographic keys match
              </div>
            )}
          </div>

          <div style={{ marginTop: '24px' }}>
            <button
              type="submit"
              className="btn-cyber-primary"
              style={{ width: '100%', padding: '14px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'PROVISIONING CREDENTIALS...' : 'ENROLL OPERATIVE IN NEXORA'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Already registered in the network?{' '}
          <Link to="/login" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600 }}>
            Authenticate Now →
          </Link>
        </div>
      </div>
    </div>
  );
};
