import React, { useEffect, useState, useRef } from 'react';
import { api, UserProfileResponse, PostItem } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PostCard } from './PostCard';
import { UserPlus, UserCheck, Edit3, Globe, Code2, ArrowLeft, X, Camera } from 'lucide-react';

interface ProfileViewProps {
  username: string;
  onBack: () => void;
  onOpenAuth: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ username, onBack, onOpenAuth }) => {
  const { user: currentUser } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Edit fields
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGithub, setEditGithub] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await api.users.getProfile(username);
      setProfileData(data);
      setIsFollowing(Boolean(data.isFollowing));
      setFollowersCount(data.followersCount || 0);

      setEditDisplayName(data.displayName || '');
      setEditBio(data.bio || '');
      setEditGithub(data.githubUrl || '');
      setEditWebsite(data.websiteUrl || '');
      setEditAvatarUrl(data.avatarUrl || '');
      setEditCoverUrl(data.coverUrl || '');

      // Load all posts authored by this user directly
      try {
        const posts = await api.users.getUserPosts(username);
        setUserPosts(Array.isArray(posts) ? posts : []);
      } catch {
        setUserPosts([]);
      }
    } catch {
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!profileData) return;

    const targetUserId = profileData.userId;
    const prevFollowing = isFollowing;
    const prevCount = followersCount;

    setIsFollowing(!prevFollowing);
    setFollowersCount(prevFollowing ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      if (prevFollowing) {
        await api.users.unfollow(targetUserId);
      } else {
        await api.users.follow(targetUserId);
      }
    } catch {
      setIsFollowing(prevFollowing);
      setFollowersCount(prevCount);
    }
  };

  const handleImageUpload = async (file: File, type: 'avatar' | 'cover') => {
    if (file.size > 4.5 * 1024 * 1024) {
      alert('File size exceeds maximum allowed size (4.5MB). Please choose a smaller image.');
      return;
    }

    if (type === 'avatar') setUploadingAvatar(true);
    else setUploadingBanner(true);

    try {
      const mimeType = file.type || 'image/jpeg';
      const uploadRes = await api.media.requestUploadUrl({
        filename: file.name,
        mimeType,
        byteSize: file.size,
        purpose: type === 'avatar' ? 'avatar' : 'cover',
      });

      await api.media.uploadDirect(uploadRes.uploadUrl, file, mimeType);
      await api.media.confirm(uploadRes.mediaId);

      const targetUrl = `/api/v1/media/${uploadRes.mediaId}`;
      if (type === 'avatar') {
        setEditAvatarUrl(targetUrl);
        await api.users.updateProfile({ avatarUrl: targetUrl });
      } else {
        setEditCoverUrl(targetUrl);
        await api.users.updateProfile({ coverUrl: targetUrl });
      }

      await fetchProfile();
    } catch (err: any) {
      alert(err.message || `Failed to upload ${type}`);
    } finally {
      if (type === 'avatar') setUploadingAvatar(false);
      else setUploadingBanner(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.users.updateProfile({
        displayName: editDisplayName.trim() || undefined,
        bio: editBio.trim() || null,
        githubUrl: editGithub.trim() || null,
        websiteUrl: editWebsite.trim() || null,
        avatarUrl: editAvatarUrl.trim() || null,
        coverUrl: editCoverUrl.trim() || null,
      });
      setEditModalOpen(false);
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePostDeletedInProfile = (postId: string) => {
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
    setProfileData((prev) =>
      prev ? { ...prev, postsCount: Math.max(0, prev.postsCount - 1) } : null
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
        <span className="spinner" style={{ width: '28px', height: '28px' }} />
        <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Loading developer profile...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>Developer @{username} not found.</p>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Feed
        </button>
      </div>
    );
  }

  const isOwnProfile = Boolean(
    currentUser &&
      (currentUser.id === profileData.userId ||
        currentUser.username?.toLowerCase() === profileData.username?.toLowerCase())
  );

  return (
    <div>
      {/* Hidden file inputs for direct image upload */}
      <input
        type="file"
        ref={avatarInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file, 'avatar');
        }}
      />
      <input
        type="file"
        ref={bannerInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file, 'cover');
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ paddingLeft: 0 }}
          onClick={onBack}
        >
          <ArrowLeft size={15} /> Back to Feed
        </button>
      </div>

      <div className="profile-card">
        {/* Profile Banner */}
        <div
          className="profile-banner"
          style={
            profileData.coverUrl
              ? {
                  backgroundImage: `url(${profileData.coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {isOwnProfile && (
            <button
              type="button"
              className="banner-upload-trigger"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              title="Change Banner Image"
            >
              <Camera size={14} />
              <span>{uploadingBanner ? 'Uploading...' : 'Edit Banner'}</span>
            </button>
          )}
        </div>

        <div className="profile-body">
          <div className="profile-avatar-row">
            <div className="profile-avatar-wrapper">
              {profileData.avatarUrl ? (
                <img
                  src={profileData.avatarUrl}
                  alt={profileData.username}
                  className="avatar avatar-lg"
                />
              ) : (
                <div className="avatar avatar-lg">
                  {profileData.username.slice(0, 2).toUpperCase()}
                </div>
              )}

              {isOwnProfile && (
                <button
                  type="button"
                  className="avatar-upload-trigger"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change Avatar Photo"
                >
                  <Camera size={13} />
                </button>
              )}
            </div>

            <div>
              {isOwnProfile ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditModalOpen(true)}
                  id="edit-profile-btn"
                >
                  <Edit3 size={14} /> Edit Profile
                </button>
              ) : (
                <button
                  className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                  onClick={handleFollowToggle}
                  id="follow-user-btn"
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={14} /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} /> Follow
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: '1.35rem', marginBottom: '2px', color: '#ffffff' }}>
            {profileData.displayName || profileData.username}
          </h2>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '12px' }}>
            @{profileData.username}
          </div>

          {profileData.bio && (
            <p style={{ color: '#cbd5e1', marginBottom: '14px', maxWidth: '640px', fontSize: '0.92rem' }}>
              {profileData.bio}
            </p>
          )}

          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-dim)', fontSize: '0.84rem', flexWrap: 'wrap' }}>
            {profileData.githubUrl && (
              <a
                href={profileData.githubUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Code2 size={14} /> {profileData.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
              </a>
            )}
            {profileData.websiteUrl && (
              <a
                href={profileData.websiteUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Globe size={14} /> {profileData.websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          <div className="profile-stats-row">
            <div className="stat-item">
              <span className="stat-value">{userPosts.length}</span>
              <span className="stat-label">Posts</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{followersCount}</span>
              <span className="stat-label">Followers</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{profileData.followingCount || 0}</span>
              <span className="stat-label">Following</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>Posts by @{username}</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{userPosts.length} published</span>
      </div>

      {userPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: '#0a0a0a', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          No technical discussions published by @{username} yet.
        </div>
      ) : (
        userPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onOpenAuthor={() => {}}
            onOpenAuth={onOpenAuth}
            onPostDeleted={handlePostDeletedInProfile}
          />
        ))
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditModalOpen(false)}>
              <X size={18} />
            </button>
            <h2 className="modal-title">Edit Developer Profile</h2>
            <p className="modal-subtitle">Update your profile avatar, banner, bio, and links</p>

            <form onSubmit={handleSaveProfile} style={{ marginTop: '18px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera size={14} /> Upload Avatar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => bannerInputRef.current?.click()}
                >
                  <Camera size={14} /> Upload Banner
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g. Radwan Eldaly"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell the community about your engineering background, tech stack, and systems you build..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Avatar Image URL (or upload above)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://... or /api/v1/media/..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Banner Image URL (or upload above)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  placeholder="https://... or /api/v1/media/..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">GitHub Profile</label>
                <input
                  type="url"
                  className="form-input"
                  value={editGithub}
                  onChange={(e) => setEditGithub(e.target.value)}
                  placeholder="https://github.com/your-username"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Website / Portfolio</label>
                <input
                  type="url"
                  className="form-input"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://yourblog.dev"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', marginTop: '10px' }}
                disabled={savingProfile}
              >
                {savingProfile ? <span className="spinner" /> : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

