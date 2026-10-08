import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().max(2048).nullable().optional(),
  coverUrl: z.string().max(2048).nullable().optional(),
  githubUrl: z.string().max(255).nullable().optional(),
  websiteUrl: z.string().max(255).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
