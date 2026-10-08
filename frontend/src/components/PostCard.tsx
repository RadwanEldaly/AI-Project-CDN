import React, { useState } from 'react';
import { api, PostItem } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageSquare, Share2, Trash2, Tag, Check, CornerDownRight } from 'lucide-react';

interface PostCardProps {
  post: PostItem;
  onOpenAuthor: (username: string) => void;
  onOpenAuth: () => void;
  onPostDeleted?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onOpenAuthor,
  onOpenAuth,
  onPostDeleted,
}) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = Boolean(
    user && (
      user.id === post.authorId ||
      user.id === post.author?.id ||
      user.username?.toLowerCase() === post.author?.username?.toLowerCase() ||
      user.role === 'admin' ||
      user.role === 'moderator'
    )
  );

  const handleLikeToggle = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    const previousLiked = liked;
    const previousCount = likesCount;

    // Optimistic UI update
    setLiked(!previousLiked);
    setLikesCount(previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    try {
      if (previousLiked) {
        await api.interactions.unlike(post.id);
      } else {
        await api.interactions.like(post.id);
      }
    } catch {
      // Rollback on network failure
      setLiked(previousLiked);
      setLikesCount(previousCount);
    }
  };

  const handleToggleComments = async () => {
    const nextState = !showComments;
    setShowComments(nextState);

    if (nextState && comments.length === 0) {
      setLoadingComments(true);
      try {
        const data = await api.interactions.getComments(post.id);
        setComments(data);
      } catch {
        // ignore
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const newComment = await api.interactions.createComment(post.id, commentText.trim());
      setComments([...comments, newComment]);
      setCommentsCount((prev) => prev + 1);
      setCommentText('');
    } catch {
      // ignore
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.posts.delete(post.id);
      if (onPostDeleted) onPostDeleted(post.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete post');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#post-${post.id}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <article className="post-card" id={`post-${post.id}`}>
      <header className="post-header">
        <div className="author-meta" onClick={() => onOpenAuthor(post.author.username)}>
          {post.author.avatarUrl ? (
            <img src={post.author.avatarUrl} alt={post.author.username} className="avatar" />
          ) : (
            <div className="avatar">{post.author.username.slice(0, 2).toUpperCase()}</div>
          )}
          <div className="author-info">
            <span className="author-name">
              {post.author.displayName || post.author.username}
            </span>
            <span className="author-username">@{post.author.username}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <time className="post-time">{timeAgo(post.createdAt)}</time>
          {isAuthor && (
            confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    background: '#dc2626',
                    color: '#ffffff',
                    border: '1px solid #dc2626',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                  onClick={handleDelete}
                  disabled={isDeleting}
                  id={`confirm-delete-btn-${post.id}`}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    background: '#222222',
                    color: '#ffffff',
                    border: '1px solid #444444',
                    borderRadius: '4px',
                  }}
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="action-btn"
                onClick={() => setConfirmDelete(true)}
                title="Delete post"
                style={{ color: 'var(--text-dim)', padding: '4px' }}
                id={`delete-post-btn-${post.id}`}
              >
                <Trash2 size={16} />
              </button>
            )
          )}
        </div>
      </header>

      <h3 className="post-title">{post.title}</h3>

      {/* Render Markdown or Fallback Body */}
      <div className="post-body">
        {post.renderedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: post.renderedHtml }} />
        ) : (
          <p>{post.content || (post as any).body}</p>
        )}
      </div>

      {/* Media Attachment */}
      {post.media && post.media.length > 0 && (
        <div className="post-media-container">
          {post.media.map((item: any) => {
            const mediaSrc = item.optimizedUrl || item.originalUrl || item.targetPublicUrl;
            if (!mediaSrc) return null;
            return item.mediaType === 'video' ? (
              <video key={item.id} src={mediaSrc} controls preload="metadata" />
            ) : (
              <img key={item.id} src={mediaSrc} alt="Post illustration" loading="lazy" />
            );
          })}
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="post-tags-row">
          {post.tags.map((t) => (
            <span key={t} className="post-tag">
              <Tag size={12} style={{ marginRight: '4px', opacity: 0.7 }} />
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Action Footer */}
      <footer className="post-actions">
        <button
          className={`action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLikeToggle}
          id={`like-btn-${post.id}`}
        >
          <Heart size={16} />
          <span>{likesCount}</span>
        </button>

        <button
          className="action-btn"
          onClick={handleToggleComments}
          id={`comments-toggle-btn-${post.id}`}
        >
          <MessageSquare size={16} />
          <span>{commentsCount}</span>
        </button>

        <button className="action-btn" onClick={handleShare} title="Share post link">
          {copiedLink ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Share2 size={16} />}
          <span>{copiedLink ? 'Copied' : 'Share'}</span>
        </button>
      </footer>

      {/* Collapsible Comments Section */}
      {showComments && (
        <section className="comments-section">
          {user && (
            <form className="comment-input-box" onSubmit={handleAddComment}>
              <textarea
                className="comment-input"
                placeholder="Write a constructive comment or code response..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                required
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={submittingComment}
                style={{ alignSelf: 'flex-end', height: '42px' }}
              >
                {submittingComment ? <span className="spinner" /> : <CornerDownRight size={16} />}
              </button>
            </form>
          )}

          {loadingComments ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-dim)' }}>
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
              No comments yet. Start the discussion!
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="comment-card">
                <div
                  className="avatar avatar-sm"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpenAuthor(c.author.username)}
                >
                  {c.author.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="comment-content">
                  <div className="comment-author-row">
                    <span
                      className="comment-author-name"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onOpenAuthor(c.author.username)}
                    >
                      {c.author.displayName || c.author.username}
                    </span>
                    <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  </div>
                  <div className="comment-body">{c.content || (c as any).body}</div>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </article>
  );
};
