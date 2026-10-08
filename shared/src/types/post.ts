import { PostMediaItem } from './media.js';

export type PostStatus = 'draft' | 'published' | 'archived' | 'hidden';

export interface AuthorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  author: AuthorSummary;
  title: string;
  content: string;
  status: PostStatus;
  likesCount: number;
  commentsCount: number;
  tags: string[];
  media: PostMediaItem[];
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author: AuthorSummary;
  parentId?: string | null;
  content: string;
  likesCount: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}
