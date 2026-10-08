import { Kysely } from 'kysely';
import { Database } from '../../db/schema.js';
import { UserProfile, UpdateProfileInput } from '@devspace/shared';

export class UsersService {
  constructor(private db: Kysely<Database>) {}

  async getProfileByUsername(
    username: string,
    viewerId?: string
  ): Promise<UserProfile | null> {
    const profile = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('username', '=', username.toLowerCase())
      .executeTakeFirst();

    if (!profile) return null;

    let isFollowing = false;
    if (viewerId && viewerId !== profile.user_id) {
      const follow = await this.db
        .selectFrom('follows')
        .select('follower_id')
        .where('follower_id', '=', viewerId)
        .where('following_id', '=', profile.user_id)
        .executeTakeFirst();
      isFollowing = !!follow;
    }

    return {
      userId: profile.user_id,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      coverUrl: profile.cover_url,
      githubUrl: profile.github_url,
      websiteUrl: profile.website_url,
      followersCount: profile.followers_count,
      followingCount: profile.following_count,
      postsCount: profile.posts_count,
      updatedAt: profile.updated_at,
      isFollowing,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<UserProfile> {
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.displayName !== undefined) updates.display_name = input.displayName;
    if (input.bio !== undefined) updates.bio = input.bio;
    if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;
    if (input.coverUrl !== undefined) updates.cover_url = input.coverUrl;
    if (input.githubUrl !== undefined) updates.github_url = input.githubUrl;
    if (input.websiteUrl !== undefined) updates.website_url = input.websiteUrl;

    await this.db
      .updateTable('profiles')
      .set(updates)
      .where('user_id', '=', userId)
      .execute();

    const updated = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();

    return {
      userId: updated.user_id,
      username: updated.username,
      displayName: updated.display_name,
      bio: updated.bio,
      avatarUrl: updated.avatar_url,
      coverUrl: updated.cover_url,
      githubUrl: updated.github_url,
      websiteUrl: updated.website_url,
      followersCount: updated.followers_count,
      followingCount: updated.following_count,
      postsCount: updated.posts_count,
      updatedAt: updated.updated_at,
    };
  }
}
