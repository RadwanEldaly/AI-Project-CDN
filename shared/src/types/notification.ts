import { AuthorSummary } from './post.js';

export type NotificationType = 'post_liked' | 'comment_added' | 'user_followed' | 'mention';
export type NotificationResourceType = 'post' | 'comment' | 'user';

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actor: AuthorSummary;
  type: NotificationType;
  resourceId: string;
  resourceType: NotificationResourceType;
  isRead: boolean;
  createdAt: string;
  snippet?: string;
}

export interface MarkReadResult {
  markedReadCount: number;
}
