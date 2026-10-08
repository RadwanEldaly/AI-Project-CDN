import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User, Terminal } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { setUserState } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await api.auth.login({ emailOrUsername, password });
        setUserState(res.user, res.profile);
        onClose();
      } else {
        const res = await api.auth.register({
          email,
          username,
          password,
          displayName: displayName || username,
        });
        setUserState(res.user, res.profile);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div className="brand-icon" style={{ width: '26px', height: '26px' }}>
              <Terminal size={15} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#ffffff', letterSpacing: '0.04em' }}>DEVSPACE</span>
          </div>
          <h2 className="modal-title">
            {mode === 'login' ? 'Sign in to DevSpace' : 'Create developer account'}
          </h2>
          <p className="modal-subtitle">
            {mode === 'login'
              ? 'Access your personalized engineering feed, discussions, and code bookmarks.'
              : 'Join engineers discussing architectures, code patterns, and production systems.'}
          </p>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'login' ? (
            <div className="form-group">
              <label className="form-label">Email or Username</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-identifier-input"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  placeholder="e.g. torvalds or linus@kernel.org"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  required
                />
                <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="register-username-input"
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="e.g. alex_chen"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  id="register-displayname-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Alex Chen"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="register-email-input"
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="alex@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-password-input"
                type="password"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', padding: '12px' }}
            disabled={submitting}
          >
            {submitting ? (
              <span className="spinner" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); }}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
