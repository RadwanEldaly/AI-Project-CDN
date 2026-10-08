import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { api, PostItem } from './api/client';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { PostComposer } from './components/PostComposer';
import { PostCard } from './components/PostCard';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { SearchView } from './components/SearchView';
import {
  Compass,
  Users,
  Bell,
  User as UserIcon,
  Flame,
  ShieldCheck,
  RefreshCw,
  FileCode,
} from 'lucide-react';

export const App: React.FC = () => {
  const { user } = useAuth();

  // Navigation & View state
  const [currentView, setCurrentView] = useState<'feed' | 'profile' | 'notifications' | 'search'>('feed');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedTab, setFeedTab] = useState<'explore' | 'following'>('explore');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Posts & Feed State
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Load feed items
  const loadFeed = async (tag?: string | null, isFollowing = false, cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoadingPosts(true);
    }

    try {
      let res;
      if (isFollowing) {
        res = await api.feed.getFollowing(cursor);
      } else {
        res = await api.feed.getExplore(tag || undefined, cursor);
      }

      if (cursor) {
        setPosts((prev) => [...prev, ...res.items]);
      } else {
        setPosts(res.items);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch {
      if (!cursor) setPosts([]);
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (currentView === 'feed') {
      loadFeed(selectedTag, feedTab === 'following');
    }
  }, [currentView, feedTab, selectedTag, user]);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleOpenProfile = (username: string) => {
    setSelectedUsername(username);
    setCurrentView('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSearch = (q: string) => {
    setSearchQuery(q);
    setCurrentView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePostCreated = (newPost: PostItem) => {
    setPosts([newPost, ...posts]);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
      setFeedTab('explore');
      setCurrentView('feed');
    }
  };

  return (
    <div className="app-container">
      <Navbar
        onOpenAuth={handleOpenAuth}
        onOpenComposer={() => {
          if (!user) handleOpenAuth('login');
          else {
            setCurrentView('feed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onSearch={handleOpenSearch}
        onOpenProfile={handleOpenProfile}
        onOpenNotifications={() => {
          if (!user) handleOpenAuth('login');
          else setCurrentView('notifications');
        }}
        onGoHome={() => {
          setSelectedTag(null);
          setCurrentView('feed');
        }}
      />

      <main className="main-layout">
        {/* Left Navigation Sidebar */}
        <aside className="sidebar-left">
          <nav>
            <div
              className={`sidebar-nav-item ${currentView === 'feed' && feedTab === 'explore' && !selectedTag ? 'active' : ''}`}
              onClick={() => {
                setFeedTab('explore');
                setSelectedTag(null);
                setCurrentView('feed');
              }}
            >
              <Compass size={18} />
              <span className="nav-text">Explore Discussions</span>
            </div>

            <div
              className={`sidebar-nav-item ${currentView === 'feed' && feedTab === 'following' ? 'active' : ''}`}
              onClick={() => {
                if (!user) {
                  handleOpenAuth('login');
                  return;
                }
                setFeedTab('following');
                setSelectedTag(null);
                setCurrentView('feed');
              }}
            >
              <Users size={18} />
              <span className="nav-text">Following Network</span>
            </div>

            <div
              className={`sidebar-nav-item ${currentView === 'notifications' ? 'active' : ''}`}
              onClick={() => {
                if (!user) {
                  handleOpenAuth('login');
                  return;
                }
                setCurrentView('notifications');
              }}
            >
              <Bell size={18} />
              <span className="nav-text">Notifications</span>
            </div>

            {user && (
              <div
                className={`sidebar-nav-item ${currentView === 'profile' && selectedUsername === user.username ? 'active' : ''}`}
                onClick={() => handleOpenProfile(user.username)}
              >
                <UserIcon size={18} />
                <span className="nav-text">My Profile</span>
              </div>
            )}
          </nav>

          {/* Genuine Community Standards Widget */}
          <div className="widget-card" style={{ marginTop: '20px' }}>
            <div className="widget-header">
              <ShieldCheck size={16} />
              <span>Engineering Guild</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                <span>Production post-mortems</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                <span>Reproducible benchmarks</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                <span>Architecture RFCs</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Main Feed Content */}
        <section style={{ minWidth: 0 }}>
          {currentView === 'profile' ? (
            <ProfileView
              username={selectedUsername}
              onBack={() => setCurrentView('feed')}
              onOpenAuth={() => handleOpenAuth('login')}
            />
          ) : currentView === 'notifications' ? (
            <NotificationsView
              onBack={() => setCurrentView('feed')}
              onOpenAuthor={handleOpenProfile}
            />
          ) : currentView === 'search' ? (
            <SearchView
              initialQuery={searchQuery}
              onBack={() => setCurrentView('feed')}
              onOpenAuthor={handleOpenProfile}
              onOpenAuth={() => handleOpenAuth('login')}
            />
          ) : (
            <>
              {/* Post Composer */}
              <PostComposer
                onPostCreated={handlePostCreated}
                onOpenAuth={() => handleOpenAuth('login')}
              />

              {/* Feed Navigation Tabs */}
              <div className="feed-tabs-bar">
                <div
                  className={`feed-tab ${feedTab === 'explore' ? 'active' : ''}`}
                  onClick={() => setFeedTab('explore')}
                >
                  <Compass size={16} />
                  <span>Explore Discussions</span>
                </div>

                {user && (
                  <div
                    className={`feed-tab ${feedTab === 'following' ? 'active' : ''}`}
                    onClick={() => setFeedTab('following')}
                  >
                    <Users size={16} />
                    <span>My Follow Network</span>
                  </div>
                )}

                {selectedTag && (
                  <div
                    className="feed-tab active"
                    style={{ marginLeft: 'auto', color: '#ffffff', cursor: 'pointer' }}
                    onClick={() => setSelectedTag(null)}
                  >
                    <span>#{selectedTag} ✕</span>
                  </div>
                )}
              </div>

              {/* Post Feed List */}
              {loadingPosts ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
                  <span className="spinner" style={{ width: '28px', height: '28px', borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#ffffff' }} />
                  <p style={{ marginTop: '12px' }}>Loading discussions...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="widget-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <Compass size={32} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
                  <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No discussions found</h3>
                  <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 18px', fontSize: '0.9rem' }}>
                    {feedTab === 'following'
                      ? "You haven't followed any engineers with posts yet. Switch to Explore or follow some developers."
                      : selectedTag
                      ? `No discussions tagged with #${selectedTag} yet.`
                      : 'Be the first developer to publish an architecture deep-dive or code solution.'}
                  </p>
                  {feedTab === 'following' && (
                    <button className="btn btn-secondary" onClick={() => setFeedTab('explore')}>
                      Switch to Explore
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onOpenAuthor={handleOpenProfile}
                      onOpenAuth={() => handleOpenAuth('login')}
                      onPostDeleted={handlePostDeleted}
                    />
                  ))}

                  {hasMore && (
                    <div style={{ textAlign: 'center', margin: '24px 0' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '10px 24px' }}
                        onClick={() => loadFeed(selectedTag, feedTab === 'following', nextCursor || undefined)}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <span className="spinner" />
                        ) : (
                          <>
                            <RefreshCw size={15} /> Load more discussions
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* Right Trending & Community Sidebar */}
        <aside className="sidebar-right">
          {/* Trending Topics Widget */}
          <div className="widget-card">
            <div className="widget-header">
              <Flame size={16} />
              <span>Trending Topics</span>
            </div>
            <div className="tag-cloud">
              {[
                'postgres',
                'distributed-systems',
                'typescript',
                'linux',
                'architecture',
                'rust',
                'concurrency',
                'security',
                'api-design',
              ].map((t) => (
                <button
                  key={t}
                  className={`tag-pill ${selectedTag === t ? 'active' : ''}`}
                  onClick={() => handleTagClick(t)}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>

          {/* Featured Community Engineering Guidelines */}
          <div className="widget-card">
            <div className="widget-header">
              <FileCode size={16} />
              <span>DevSpace Standards</span>
            </div>
            <ul style={{ paddingLeft: '18px', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'grid', gap: '8px' }}>
              <li>Share production insights & code snippets</li>
              <li>Provide constructive architecture reviews</li>
              <li>Include reproducible benchmarks for performance claims</li>
              <li>No spam or vendor marketing</li>
            </ul>
          </div>
        </aside>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-btn ${currentView === 'feed' && feedTab === 'explore' && !selectedTag ? 'active' : ''}`}
          onClick={() => {
            setFeedTab('explore');
            setSelectedTag(null);
            setCurrentView('feed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Compass size={20} />
          <span>Explore</span>
        </button>

        <button
          className={`mobile-nav-btn ${currentView === 'feed' && feedTab === 'following' ? 'active' : ''}`}
          onClick={() => {
            if (!user) {
              handleOpenAuth('login');
              return;
            }
            setFeedTab('following');
            setSelectedTag(null);
            setCurrentView('feed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Users size={20} />
          <span>Following</span>
        </button>

        <button
          className={`mobile-nav-btn ${currentView === 'notifications' ? 'active' : ''}`}
          onClick={() => {
            if (!user) {
              handleOpenAuth('login');
              return;
            }
            setCurrentView('notifications');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Bell size={20} />
          <span>Alerts</span>
        </button>

        {user ? (
          <button
            className={`mobile-nav-btn ${currentView === 'profile' && selectedUsername === user.username ? 'active' : ''}`}
            onClick={() => handleOpenProfile(user.username)}
          >
            <UserIcon size={20} />
            <span>Profile</span>
          </button>
        ) : (
          <button
            className="mobile-nav-btn"
            onClick={() => handleOpenAuth('login')}
          >
            <UserIcon size={20} />
            <span>Sign In</span>
          </button>
        )}
      </nav>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
};
