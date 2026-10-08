import { z } from 'zod';

export const RequestUploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ]),
  byteSize: z.number().int().positive().max(52428800, 'Files cannot exceed 50 MB'),
  purpose: z.enum(['post_attachment', 'avatar', 'cover']),
});

export const ConfirmUploadSchema = z.object({
  mediaId: z.string().uuid('Invalid media ID'),
});

export type RequestUploadUrlInput = z.infer<typeof RequestUploadUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>;
