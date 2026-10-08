export type MediaType = 'image' | 'video';
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'rejected';

export interface PostMediaItem {
  id: string;
  postId?: string | null;
  mediaType: MediaType;
  originalUrl: string;
  optimizedUrl?: string | null;
  thumbnailUrl?: string | null;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  orderIndex: number;
  createdAt: string;
}

export interface UploadUrlResponse {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}
