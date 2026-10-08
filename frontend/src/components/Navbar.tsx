import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Terminal, Search, Bell, PenSquare, LogOut, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenComposer: () => void;
  onSearch: (query: string) => void;
  onOpenProfile: (username: string) => void;
  onOpenNotifications: () => void;
  onGoHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  onOpenComposer,
  onSearch,
  onOpenProfile,
  onOpenNotifications,
  onGoHome,
}) => {
  const { user, profile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const checkUnread = async () => {
      try {
        const res = await api.notifications.getUnreadCount();
        setUnreadCount(res.unreadCount);
      } catch {
        // ignore
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  return (
    <header className="navbar">
      <div className="nav-brand" onClick={onGoHome}>
        <div className="brand-icon">
          <Terminal size={18} />
        </div>
        <span className="brand-title">DevSpace</span>
      </div>

      <form className="nav-search" onSubmit={handleSearchSubmit}>
        <Search size={16} className="search-icon" />
        <input
          id="global-search-input"
          type="search"
          className="search-input"
          placeholder="Search technical discussions, architectures, or engineers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      <div className="nav-actions">
        {user ? (
          <>
            <button
              id="new-post-btn"
              className="btn btn-primary"
              onClick={onOpenComposer}
            >
              <PenSquare size={16} />
              <span className="nav-text">New Post</span>
            </button>

            <button
              id="notifications-btn"
              className="btn-icon"
              title="Notifications"
              onClick={onOpenNotifications}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="badge-counter">{unreadCount}</span>}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                id="user-profile-menu-btn"
                className="btn-icon"
                style={{ overflow: 'hidden', padding: 0 }}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={user.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div className="avatar avatar-sm">{user.username.slice(0, 2).toUpperCase()}</div>
                )}
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '48px',
                    right: 0,
                    width: '220px',
                    background: '#0a0a0a',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.95)',
                    padding: '8px',
                    zIndex: 200,
                  }}
                >
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'white' }}>{profile?.displayName || user.username}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      @{user.username}
                    </div>
                  </div>

                  <button
                    className="sidebar-nav-item"
                    style={{ width: '100%', marginTop: '6px' }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenProfile(user.username);
                    }}
                  >
                    <UserIcon size={16} />
                    <span>My Profile</span>
                  </button>

                  <button
                    className="sidebar-nav-item"
                    style={{ width: '100%', color: 'var(--danger)' }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              id="nav-signin-btn"
              className="btn btn-secondary"
              onClick={() => onOpenAuth('login')}
            >
              Sign In
            </button>
            <button
              id="nav-register-btn"
              className="btn btn-primary"
              onClick={() => onOpenAuth('register')}
            >
              Create Account
            </button>
          </>
        )}
      </div>
    </header>
  );
};
