import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .transform((val) => val.trim().toLowerCase()),
  username: z
    .string({ required_error: 'Username is required' })
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string({ required_error: 'Password is required' })
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  displayName: z
    .string({ required_error: 'Display name is required' })
    .min(2, 'Display name must be at least 2 characters')
    .max(64, 'Display name cannot exceed 64 characters')
    .transform((val) => val.trim()),
});

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
