/**
 * DevSpace API Client
 * Built with native Fetch and credentials: 'include' for HttpOnly session cookies.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
}

export interface PostItem {
  id: string;
  authorId: string;
  title: string;
  content: string;
  renderedHtml?: string | null;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  media?: Array<{
    id: string;
    mediaType: 'image' | 'video';
    originalUrl?: string;
    optimizedUrl?: string;
    thumbnailUrl?: string;
    targetPublicUrl?: string;
    status?: string;
  }>;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
}

export interface FeedResponse {
  items: PostItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorAvatarUrl: string | null;
  type: 'like' | 'comment' | 'follow' | 'mention';
  postId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface UserProfileResponse {
  userId: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  githubUrl?: string | null;
  twitterUrl?: string | null;
  websiteUrl?: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  updatedAt?: string;
  isFollowing?: boolean;
}

const BASE_URL = '/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Mandatory for HttpOnly session cookie handling
  });

  const json: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: { code: 'INVALID_JSON', message: 'Failed to parse JSON response' },
  }));

  if (!response.ok || !json.success) {
    let errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    if (json.error?.details && Array.isArray(json.error.details) && json.error.details.length > 0) {
      const detailedIssues = json.error.details.map((d: any) => d.issue || d.message).filter(Boolean).join('. ');
      if (detailedIssues) {
        errorMsg = detailedIssues;
      }
    }
    const err = new Error(errorMsg) as Error & { code?: string; details?: any };
    err.code = json.error?.code || 'HTTP_ERROR';
    err.details = json.error?.details;
    throw err;
  }

  // Normalize pagination envelopes
  if (json.meta && Array.isArray(json.data)) {
    return {
      items: json.data,
      nextCursor: json.meta.cursor,
      hasMore: json.meta.hasMore,
    } as unknown as T;
  }

  return json.data as T;
}

export const api = {
  // Auth
  auth: {
    register: (data: { email: string; username: string; password: string; displayName?: string }) =>
      request<{ user: any; profile: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { emailOrUsername: string; password: string }) =>
      request<{ user: any; profile: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () =>
      request<{ message: string }>('/auth/logout', {
        method: 'POST',
      }),
    getMe: () =>
      request<{ user: any; profile: any }>('/auth/me'),
  },

  // Users & Profiles
  users: {
    getProfile: (username: string) =>
      request<UserProfileResponse>(`/users/${encodeURIComponent(username)}`),
    updateProfile: (data: Partial<{ displayName: string; bio: string | null; githubUrl: string | null; websiteUrl: string | null; avatarUrl: string | null; coverUrl: string | null }>) =>
      request<UserProfileResponse>('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    follow: (userId: string) =>
      request<{ following: boolean }>(`/users/${userId}/follow`, {
        method: 'POST',
      }),
    unfollow: (userId: string) =>
      request<{ following: boolean }>(`/users/${userId}/follow`, {
        method: 'DELETE',
      }),
  },

  // Posts
  posts: {
    create: (data: { title: string; content: string; tags?: string[]; mediaIds?: string[] }) =>
      request<PostItem>('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getById: (id: string) =>
      request<PostItem>(`/posts/${id}`),
    delete: (id: string) =>
      request<{ message: string }>(`/posts/${id}`, {
        method: 'DELETE',
      }),
  },

  // Interactions (Likes & Comments)
  interactions: {
    like: (postId: string) =>
      request<{ liked: boolean }>(`/posts/${postId}/like`, {
        method: 'POST',
      }),
    unlike: (postId: string) =>
      request<{ liked: boolean }>(`/posts/${postId}/like`, {
        method: 'DELETE',
      }),
    getComments: (postId: string) =>
      request<Array<{
        id: string;
        authorId: string;
        content: string;
        author: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
        };
        createdAt: string;
      }>>(`/posts/${postId}/comments`),
    createComment: (postId: string, content: string, parentId?: string) =>
      request<{
        id: string;
        content: string;
        createdAt: string;
        author: { id: string; username: string; displayName: string; avatarUrl: string | null };
      }>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parentId }),
      }),
  },

  // Feeds
  feed: {
    getFollowing: (cursor?: string, limit = 15) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      params.set('limit', limit.toString());
      return request<FeedResponse>(`/feed?${params.toString()}`);
    },
    getExplore: (tag?: string, cursor?: string, limit = 15) => {
      const params = new URLSearchParams();
      if (tag) params.set('tag', tag);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', limit.toString());
      return request<FeedResponse>(`/feed/explore?${params.toString()}`);
    },
  },

  // Search
  search: {
    query: async (q: string, type: 'posts' | 'users' = 'posts') => {
      const params = new URLSearchParams({ q, type });
      const data = await request<any[]>(`/search?${params.toString()}`);
      return { query: q, type, results: data || [] };
    },
  },

  // Notifications
  notifications: {
    getAll: () =>
      request<NotificationItem[]>('/notifications'),
    getUnreadCount: () =>
      request<{ unreadCount: number }>('/notifications/unread-count'),
    markRead: (ids?: string[]) =>
      request<{ markedCount: number }>('/notifications/mark-read', {
        method: 'PATCH',
        body: JSON.stringify({ ids }),
      }),
  },

  // Media Handshake & Direct Upload
  media: {
    requestUploadUrl: (data: {
      filename: string;
      mimeType: string;
      byteSize: number;
      purpose: 'post_attachment' | 'avatar' | 'cover';
    }) =>
      request<{ uploadUrl: string; storageKey: string; mediaId: string; expiresInSeconds: number }>('/media/upload-url', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    uploadDirect: async (uploadUrl: string, file: Blob, mimeType: string) => {
      const targetUrl = uploadUrl.startsWith('http') ? uploadUrl : `${window.location.origin}${uploadUrl}`;
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: file,
      });
      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }
      return true;
    },
    confirm: (mediaId: string) =>
      request<{ mediaId: string; status: string; message?: string }>('/media/confirm', {
        method: 'POST',
        body: JSON.stringify({ mediaId }),
      }),
  },
};
