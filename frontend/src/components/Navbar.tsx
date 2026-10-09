import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Terminal, Search, Bell, Plus, PenSquare, Video, LogOut, User as UserIcon } from 'lucide-react';
import { SearchModal } from './SearchModal';

interface NavbarProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenComposer: (mode?: 'post' | 'clip') => void;
  onSearch: (query: string) => void;
  onOpenProfile: (username: string) => void;
  onOpenNotifications: () => void;
  onGoHome: () => void;
  onSelectTag?: (tag: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  onOpenComposer,
  onOpenProfile,
  onOpenNotifications,
  onGoHome,
  onSelectTag,
}) => {
  const { user, profile, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [navAvatarError, setNavAvatarError] = useState(false);

  useEffect(() => {
    setNavAvatarError(false);
  }, [profile?.avatarUrl]);

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

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="nav-brand" onClick={onGoHome}>
          <div className="brand-icon">
            <Terminal size={18} />
          </div>
          <span className="brand-title">DevSpace</span>
        </div>

        {/* Center Search Trigger Button */}
        <div className="nav-search-wrapper">
          <button
            type="button"
            className="nav-search-trigger"
            onClick={() => setSearchModalOpen(true)}
          >
            <Search size={15} className="search-trigger-icon" />
            <span className="search-trigger-text">Search topics, architecture RFCs, code, engineers...</span>
            <span className="search-trigger-kbd">⌘K</span>
          </button>
        </div>

        <div className="nav-actions">
          {/* Mobile Search Icon */}
          <button
            type="button"
            className="btn-icon mobile-search-btn"
            title="Search (⌘K)"
            onClick={() => setSearchModalOpen(true)}
          >
            <Search size={17} />
          </button>

          {user ? (
            <>
              {/* Downward New Post / Reel Dropdown Menu */}
              <div style={{ position: 'relative' }}>
                <button
                  id="new-post-btn"
                  className="btn-icon btn-icon-create"
                  title="Create Post or Clip"
                  onClick={() => {
                    setCreateMenuOpen(!createMenuOpen);
                    setUserMenuOpen(false);
                  }}
                >
                  <Plus size={18} />
                </button>

                {createMenuOpen && (
                  <div className="create-dropdown-menu">
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        onOpenComposer('post');
                      }}
                    >
                      <PenSquare size={16} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>Write Post</div>
                        <div style={{ fontSize: '0.74rem', color: '#888888' }}>Markdown article, benchmark, or RFC</div>
                      </div>
                    </button>

                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        onOpenComposer('clip');
                      }}
                    >
                      <Video size={16} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>Upload Video Clip / Reel</div>
                        <div style={{ fontSize: '0.74rem', color: '#888888' }}>Tech demo, short reel, clip (MP4)</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Notifications Button */}
              <button
                id="notifications-btn"
                className="btn-icon"
                title="Notifications"
                onClick={onOpenNotifications}
              >
                <Bell size={17} />
                {unreadCount > 0 && <span className="badge-counter">{unreadCount}</span>}
              </button>

              {/* User Avatar & Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  id="user-profile-menu-btn"
                  className="btn-icon"
                  style={{ overflow: 'hidden', padding: 0 }}
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setCreateMenuOpen(false);
                  }}
                >
                  {profile?.avatarUrl && !navAvatarError ? (
                    <img
                      src={profile.avatarUrl}
                      alt={user.username}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setNavAvatarError(true)}
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
                      <UserIcon size={15} />
                      <span>My Profile</span>
                    </button>

                    <button
                      className="dropdown-item dropdown-item-danger"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                    >
                      <LogOut size={15} />
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
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenAuth('login')}
              >
                Sign In
              </button>
              <button
                id="nav-register-btn"
                className="btn btn-primary btn-sm"
                onClick={() => onOpenAuth('register')}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      {/* Search Command Palette Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onOpenProfile={onOpenProfile}
        onSelectTag={onSelectTag}
      />
    </>
  );
};

