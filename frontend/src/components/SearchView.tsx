import React, { useEffect, useState } from 'react';
import { api, PostItem } from '../api/client';
import { PostCard } from './PostCard';
import { Search, User, FileText, ArrowLeft } from 'lucide-react';

interface SearchViewProps {
  initialQuery: string;
  onBack: () => void;
  onOpenAuthor: (username: string) => void;
  onOpenAuth: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  initialQuery,
  onBack,
  onOpenAuthor,
  onOpenAuth,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<'posts' | 'users'>('posts');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = async (q: string, searchType: 'posts' | 'users') => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.search.query(q.trim(), searchType);
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performSearch(query, type);
  }, [query, type]);

  return (
    <div>
      <button className="btn btn-ghost" style={{ paddingLeft: 0, marginBottom: '16px' }} onClick={onBack}>
        <ArrowLeft size={16} /> Back to Feed
      </button>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Search Results</h2>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-dim)' }} />
          <input
            type="search"
            className="form-input"
            style={{ paddingLeft: '42px', fontSize: '1rem', height: '46px' }}
            placeholder="Search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className={`btn ${type === 'posts' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setType('posts')}
          >
            <FileText size={16} /> Posts
          </button>
          <button
            className={`btn ${type === 'users' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setType('users')}
          >
            <User size={16} /> Developers
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
          <span className="spinner" />
          <p style={{ marginTop: '10px' }}>Searching discussions and engineers...</p>
        </div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ color: 'var(--text-dim)' }}>No results found for "{query}".</p>
        </div>
      ) : type === 'posts' ? (
        results.map((post: PostItem) => (
          <PostCard
            key={post.id}
            post={post}
            onOpenAuthor={onOpenAuthor}
            onOpenAuth={onOpenAuth}
            onPostDeleted={(deletedId) =>
              setResults((prev) => prev.filter((item: any) => item.id !== deletedId))
            }
          />
        ))
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {results.map((dev: any) => {
            const devId = dev.userId || dev.id;
            const devUsername = dev.username;
            const devDisplayName = dev.displayName || dev.display_name || dev.username;
            const devAvatar = dev.avatarUrl || dev.avatar_url;

            return (
              <div
                key={devId}
                className="widget-card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => onOpenAuthor(devUsername)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {devAvatar ? (
                    <img src={devAvatar} alt={devUsername} className="avatar" />
                  ) : (
                    <div className="avatar">{devUsername.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div>
                    <h4 style={{ color: 'white', marginBottom: '2px' }}>{devDisplayName}</h4>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      @{devUsername}
                    </div>
                    {dev.bio && (
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {dev.bio}
                      </p>
                    )}
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                  View Profile
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
