import React, { useEffect, useState } from 'react';
import { api, UserProfileResponse, PostItem } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PostCard } from './PostCard';
import { UserPlus, UserCheck, Edit3, Globe, Code2, MessageCircle, ArrowLeft, X } from 'lucide-react';

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
  const [savingProfile, setSavingProfile] = useState(false);

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

      // Load user's recent posts
      try {
        const searchRes = await api.search.query(username, 'posts');
        if (searchRes && Array.isArray(searchRes.results)) {
          setUserPosts(
            searchRes.results.filter(
              (p: any) => p.author?.username?.toLowerCase() === username.toLowerCase()
            )
          );
        }
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.users.updateProfile({
        displayName: editDisplayName.trim() || undefined,
        bio: editBio.trim() || null,
        githubUrl: editGithub.trim() || null,
        websiteUrl: editWebsite.trim() || null,
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
        <span className="spinner" style={{ width: '32px', height: '32px' }} />
        <p style={{ marginTop: '12px' }}>Loading developer profile...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>Developer @{username} not found.</p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Feed
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
      <button
        className="btn btn-ghost"
        style={{ marginBottom: '16px', paddingLeft: 0 }}
        onClick={onBack}
      >
        <ArrowLeft size={16} /> Back to Feed
      </button>

      <div className="profile-card">
        <div className="profile-banner" />
        <div className="profile-body">
          <div className="profile-avatar-row">
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

            <div>
              {isOwnProfile ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditModalOpen(true)}
                  id="edit-profile-btn"
                >
                  <Edit3 size={15} /> Edit Profile
                </button>
              ) : (
                <button
                  className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={handleFollowToggle}
                  id="follow-user-btn"
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={16} /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} /> Follow
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: '1.45rem', marginBottom: '2px' }}>
            {profileData.displayName || profileData.username}
          </h2>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '12px' }}>
            @{profileData.username}
          </div>

          {profileData.bio && (
            <p style={{ color: '#cbd5e1', marginBottom: '16px', maxWidth: '640px' }}>
              {profileData.bio}
            </p>
          )}

          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-dim)', fontSize: '0.88rem', flexWrap: 'wrap' }}>
            {profileData.githubUrl && (
              <a
                href={profileData.githubUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Code2 size={15} /> {profileData.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
              </a>
            )}
            {profileData.twitterUrl && (
              <a
                href={profileData.twitterUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <MessageCircle size={15} /> Twitter
              </a>
            )}
            {profileData.websiteUrl && (
              <a
                href={profileData.websiteUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Globe size={15} /> Website
              </a>
            )}
          </div>

          <div className="profile-stats-row">
            <div className="stat-item">
              <span className="stat-value">{profileData.postsCount || 0}</span>
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

      <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Posts by @{username}</h3>

      {userPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}>
          No public technical posts published yet.
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
              <X size={20} />
            </button>
            <h2 className="modal-title">Edit Developer Profile</h2>
            <p className="modal-subtitle">Update your bio, name, and developer links</p>

            <form onSubmit={handleSaveProfile} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g. Linus Torvalds"
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
                <label className="form-label">GitHub URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={editGithub}
                  onChange={(e) => setEditGithub(e.target.value)}
                  placeholder="https://github.com/your-handle"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Portfolio / Website URL</label>
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
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
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
