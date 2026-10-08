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
                <div className="user-dropdown-menu">
                  <div className="dropdown-user-header">
                    <div className="dropdown-user-name">{profile?.displayName || user.username}</div>
                    <div className="dropdown-user-handle">@{user.username}</div>
                  </div>

                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenProfile(user.username);
                    }}
                  >
                    <UserIcon size={16} />
                    <span>My Profile</span>
                  </button>

                  <button
                    className="dropdown-item dropdown-item-danger"
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
