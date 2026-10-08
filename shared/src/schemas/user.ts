import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(64).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().url().max(1024).nullable().optional(),
  coverUrl: z.string().url().max(1024).nullable().optional(),
  githubUrl: z.string().url().max(255).nullable().optional(),
  websiteUrl: z.string().url().max(255).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
