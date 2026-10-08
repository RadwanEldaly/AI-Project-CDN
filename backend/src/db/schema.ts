import { Generated } from 'kysely';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended' | 'deactivated';
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface ProfilesTable {
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  github_url: string | null;
  website_url: string | null;
  followers_count: Generated<number>;
  following_count: Generated<number>;
  posts_count: Generated<number>;
  updated_at: Generated<string>;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: string;
  created_at: Generated<string>;
}

export interface PostsTable {
  id: Generated<string>;
  author_id: string;
  title: string;
  content: string;
  status: Generated<'draft' | 'published' | 'archived' | 'hidden'>;
  likes_count: Generated<number>;
  comments_count: Generated<number>;
  search_vector: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  deleted_at: string | null;
}

export interface PostMediaTable {
  id: Generated<string>;
  post_id: string | null;
  uploader_id: string;
  media_type: 'image' | 'video';
  storage_key: string;
  original_url: string;
  optimized_url: string | null;
  thumbnail_url: string | null;
  media_data: string | null;
  mime_type: string | null;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  order_index: Generated<number>;
  status: Generated<'pending' | 'processing' | 'ready' | 'failed' | 'rejected'>;
  created_at: Generated<string>;
}

export interface CommentsTable {
  id: Generated<string>;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  likes_count: Generated<number>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  deleted_at: string | null;
}

export interface LikesTable {
  id: Generated<string>;
  user_id: string;
  post_id: string | null;
  comment_id: string | null;
  created_at: Generated<string>;
}

export interface FollowsTable {
  follower_id: string;
  following_id: string;
  created_at: Generated<string>;
}

export interface TagsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  posts_count: Generated<number>;
  created_at: Generated<string>;
}

export interface PostTagsTable {
  post_id: string;
  tag_id: string;
}

export interface NotificationsTable {
  id: Generated<string>;
  recipient_id: string;
  actor_id: string;
  type: 'post_liked' | 'comment_added' | 'user_followed' | 'mention';
  resource_id: string;
  resource_type: 'post' | 'comment' | 'user';
  is_read: Generated<boolean>;
  created_at: Generated<string>;
}

export interface AuditLogsTable {
  id: Generated<string>;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | null;
  ip_address: string | null;
  created_at: Generated<string>;
}

export interface Database {
  users: UsersTable;
  profiles: ProfilesTable;
  sessions: SessionsTable;
  posts: PostsTable;
  post_media: PostMediaTable;
  comments: CommentsTable;
  likes: LikesTable;
  follows: FollowsTable;
  tags: TagsTable;
  post_tags: PostTagsTable;
  notifications: NotificationsTable;
  audit_logs: AuditLogsTable;
}
