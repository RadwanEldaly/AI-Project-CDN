import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(255, 'Title cannot exceed 255 characters')
    .transform((val) => val.trim()),
  content: z
    .string({ required_error: 'Content is required' })
    .min(1, 'Content cannot be empty')
    .max(50000, 'Content cannot exceed 50,000 characters'),
  tags: z
    .array(z.string().min(1).max(32))
    .max(10, 'Maximum of 10 tags allowed')
    .optional()
    .default([]),
  mediaIds: z
    .array(z.string().uuid('Invalid media ID'))
    .max(10, 'Maximum of 10 media attachments allowed')
    .optional()
    .default([]),
});

export const UpdatePostSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(50000).optional(),
  tags: z.array(z.string().min(1).max(32)).max(10).optional(),
});

export const CreateCommentSchema = z.object({
  content: z
    .string({ required_error: 'Comment content is required' })
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment cannot exceed 5,000 characters')
    .transform((val) => val.trim()),
  parentId: z.string().uuid('Invalid parent comment ID').nullable().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
