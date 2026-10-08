import React, { useState, useEffect, useRef } from 'react';
import { api, PostItem } from '../api/client';
import { Search, X, User as UserIcon, FileText, Hash, ArrowRight } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
  onSelectTag?: (tag: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  onSelectTag,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'users'>('all');
  const [loading, setLoading] = useState(false);
  const [resultsPosts, setResultsPosts] = useState<PostItem[]>([]);
  const [resultsUsers, setResultsUsers] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setResultsPosts([]);
      setResultsUsers([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResultsPosts([]);
      setResultsUsers([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [postsRes, usersRes] = await Promise.all([
          api.search.query(query.trim(), 'posts'),
          api.search.query(query.trim(), 'users'),
        ]);
        setResultsPosts(Array.isArray(postsRes?.results) ? postsRes.results : []);
        setResultsUsers(Array.isArray(usersRes?.results) ? usersRes.results : []);
      } catch {
        setResultsPosts([]);
        setResultsUsers([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay search-modal-overlay" onClick={onClose}>
      <div className="search-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <Search size={18} className="search-modal-icon" />
          <input
            ref={inputRef}
            type="search"
            className="search-modal-input"
            placeholder="Search posts, architecture, topics (#postgres), or engineers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="search-modal-close" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {query.trim() && (
          <div className="search-modal-tabs">
            <button
              className={`search-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({resultsPosts.length + resultsUsers.length})
            </button>
            <button
              className={`search-tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              Posts ({resultsPosts.length})
            </button>
            <button
              className={`search-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Engineers ({resultsUsers.length})
            </button>
          </div>
        )}

        <div className="search-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-dim)' }}>
              <span className="spinner" style={{ width: '22px', height: '22px' }} />
              <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>Searching DevSpace index...</p>
            </div>
          ) : !query.trim() ? (
            <div className="search-suggestions">
              <div className="search-section-title">Popular Engineering Topics</div>
              <div className="search-tags-grid">
                {['postgres', 'distributed-systems', 'typescript', 'architecture', 'rust', 'concurrency'].map(
                  (tag) => (
                    <button
                      key={tag}
                      className="search-tag-chip"
                      onClick={() => {
                        onClose();
                        onSelectTag?.(tag);
                      }}
                    >
                      <Hash size={13} /> {tag}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : resultsPosts.length === 0 && resultsUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
              No matches found for "{query}". Try searching by tag or username.
            </div>
          ) : (
            <div className="search-results-list">
              {(activeTab === 'all' || activeTab === 'users') && resultsUsers.length > 0 && (
                <div className="search-group">
                  <div className="search-section-title">Engineers</div>
                  {resultsUsers.map((u) => (
                    <div
                      key={u.userId || u.id}
                      className="search-result-user"
                      onClick={() => {
                        onClose();
                        onOpenProfile(u.username);
                      }}
                    >
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.username} className="avatar avatar-sm" />
                      ) : (
                        <div className="avatar avatar-sm">{u.username.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>
                          {u.displayName || u.username}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#888888', fontFamily: 'var(--font-mono)' }}>
                          @{u.username}
                        </div>
                      </div>
                      <ArrowRight size={14} style={{ color: '#666666' }} />
                    </div>
                  ))}
                </div>
              )}

              {(activeTab === 'all' || activeTab === 'posts') && resultsPosts.length > 0 && (
                <div className="search-group">
                  <div className="search-section-title">Discussions & RFCs</div>
                  {resultsPosts.map((p) => (
                    <div
                      key={p.id}
                      className="search-result-post"
                      onClick={() => {
                        onClose();
                        if (p.author?.username) {
                          onOpenProfile(p.author.username);
                        }
                      }}
                    >
                      <FileText size={16} style={{ color: '#ffffff', flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="search-post-title">{p.title}</div>
                        <div className="search-post-snippet">{p.content.slice(0, 100)}...</div>
                        <div className="search-post-meta">
                          by @{p.author?.username} • {p.likesCount || 0} likes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
