import React, { useState, useRef } from 'react';
import { api, PostItem } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Image, Video, X, Eye, Edit3, Send, PenSquare } from 'lucide-react';

interface PostComposerProps {
  onPostCreated: (post: PostItem) => void;
  onOpenAuth: () => void;
}

export const PostComposer: React.FC<PostComposerProps> = ({ onPostCreated, onOpenAuth }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaAttachment, setMediaAttachment] = useState<{
    id: string;
    url: string;
    type: 'image' | 'video';
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="composer-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
        <PenSquare size={26} style={{ color: '#ffffff', marginBottom: '12px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#ffffff' }}>Engineering Discussions</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '18px', maxWidth: '440px', margin: '0 auto 18px' }}>
          Publish architectural deep-dives, benchmark reports, code snippets, or ask for peer reviews.
        </p>
        <button className="btn btn-primary" onClick={onOpenAuth}>
          Sign In to Publish
        </button>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingMedia(true);
    const previewUrl = URL.createObjectURL(file);

    try {
      let mimeType = file.type;
      if (!mimeType) {
        if (file.name.endsWith('.mp4')) mimeType = 'video/mp4';
        else if (file.name.endsWith('.webm')) mimeType = 'video/webm';
        else if (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (file.name.endsWith('.webp')) mimeType = 'image/webp';
        else mimeType = 'image/png';
      }

      const isVideo = mimeType.startsWith('video');

      if (file.size > 50 * 1024 * 1024) {
        throw new Error('Media file exceeds maximum allowed size (50MB)');
      }

      // 1. Request signed direct upload URL
      const uploadRes = await api.media.requestUploadUrl({
        filename: file.name,
        mimeType,
        byteSize: file.size,
        purpose: 'post_attachment',
      });

      // 2. Direct upload via PUT
      await api.media.uploadDirect(uploadRes.uploadUrl, file, mimeType);

      // 3. Confirm upload
      await api.media.confirm(uploadRes.mediaId);

      setMediaAttachment({
        id: uploadRes.mediaId,
        url: previewUrl,
        type: isVideo ? 'video' : 'image',
      });
    } catch (err: any) {
      URL.revokeObjectURL(previewUrl);
      setError(err.message || 'Failed to upload media. Please try again.');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Post title and content cannot be empty.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const parsedTags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, '').trim().toLowerCase())
        .filter((t) => t.length > 0);

      const post = await api.posts.create({
        title: title.trim(),
        content: body.trim(),
        tags: parsedTags,
        mediaIds: mediaAttachment ? [mediaAttachment.id] : undefined,
      });

      setTitle('');
      setBody('');
      setTagsInput('');
      setMediaAttachment(null);
      setActiveTab('write');
      onPostCreated(post);
    } catch (err: any) {
      setError(err.message || 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="composer-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              backgroundColor: activeTab === 'write' ? '#ffffff' : '#141414',
              color: activeTab === 'write' ? '#000000' : '#ffffff',
              borderColor: activeTab === 'write' ? '#ffffff' : '#222222',
            }}
            onClick={() => setActiveTab('write')}
          >
            <Edit3 size={14} /> Write
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              backgroundColor: activeTab === 'preview' ? '#ffffff' : '#141414',
              color: activeTab === 'preview' ? '#000000' : '#ffffff',
              borderColor: activeTab === 'preview' ? '#ffffff' : '#222222',
            }}
            onClick={() => setActiveTab('preview')}
          >
            <Eye size={14} /> Preview
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handlePublish}>
        <input
          id="composer-post-title"
          type="text"
          className="composer-title-input"
          placeholder="Title: What system, architecture, or bug did you resolve?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {activeTab === 'write' ? (
          <textarea
            id="composer-post-body"
            className="composer-textarea"
            placeholder="Write markdown technical content, code snippets, or benchmarks...

```ts
const db = getDatabase();
const users = await db.selectFrom('users').selectAll().execute();
```"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            required
          />
        ) : (
          <div
            className="post-body"
            style={{
              minHeight: '110px',
              padding: '14px',
              background: '#050505',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {body ? (
              <div dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, '<br/>') }} />
            ) : (
              <em style={{ color: 'var(--text-dim)' }}>Nothing to preview...</em>
            )}
          </div>
        )}

        {mediaAttachment && (
          <div className="composer-media-preview">
            <button
              type="button"
              className="composer-remove-media"
              onClick={() => setMediaAttachment(null)}
              title="Remove media"
            >
              <X size={16} />
            </button>
            {mediaAttachment.type === 'video' ? (
              <video src={mediaAttachment.url} controls />
            ) : (
              <img src={mediaAttachment.url} alt="Attached upload" />
            )}
          </div>
        )}

        <input
          id="composer-post-tags"
          type="text"
          className="composer-tags-input"
          placeholder="Tags: postgres, distributed-systems, nodejs (comma-separated)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        <div className="composer-footer">
          <div className="composer-tools">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/png,image/jpeg,image/webp,video/mp4"
              onChange={handleFileUpload}
            />
            <button
              id="composer-attach-image-btn"
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia || !!mediaAttachment}
            >
              <Image size={15} />
              <span>{uploadingMedia ? 'Uploading...' : 'Add Image'}</span>
            </button>
            <button
              id="composer-attach-video-btn"
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia || !!mediaAttachment}
            >
              <Video size={15} />
              <span>Add Clip (MP4)</span>
            </button>
          </div>

          <button
            id="composer-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={submitting || uploadingMedia}
          >
            {submitting ? (
              <span className="spinner" />
            ) : (
              <>
                <Send size={15} />
                <span>Publish</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
