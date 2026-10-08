export type UserRole = 'user' | 'moderator' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  updatedAt: string;
  isFollowing?: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
