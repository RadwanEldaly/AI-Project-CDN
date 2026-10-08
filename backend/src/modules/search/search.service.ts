import { Kysely } from 'kysely';
import { Database } from '../../db/schema.js';
import { Post, UserProfile } from '@devspace/shared';

export class SearchService {
  constructor(private db: Kysely<Database>) {}

  async searchPosts(queryText: string, limit: number = 20): Promise<Post[]> {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const pattern = `%${queryText.trim().toLowerCase()}%`;

    const rows = await this.db
      .selectFrom('posts')
      .innerJoin('profiles', 'posts.author_id', 'profiles.user_id')
      .select([
        'posts.id',
        'posts.author_id',
        'posts.title',
        'posts.content',
        'posts.status',
        'posts.likes_count',
        'posts.comments_count',
        'posts.created_at',
        'posts.updated_at',
        'profiles.username',
        'profiles.display_name',
        'profiles.avatar_url',
      ])
      .where('posts.deleted_at', 'is', null)
      .where('posts.status', '=', 'published')
      .where((eb) =>
        eb.or([
          eb('posts.title', 'ilike', pattern),
          eb('posts.content', 'ilike', pattern),
        ])
      )
      .orderBy('posts.created_at', 'desc')
      .limit(safeLimit)
      .execute();

    if (rows.length === 0) return [];

    const postIds = rows.map((r) => r.id);
    const tagsList = await this.db
      .selectFrom('post_tags')
      .innerJoin('tags', 'post_tags.tag_id', 'tags.id')
      .select(['post_tags.post_id', 'tags.name'])
      .where('post_tags.post_id', 'in', postIds)
      .execute();

    const tagsByPost = new Map<string, string[]>();
    for (const t of tagsList) {
      const arr = tagsByPost.get(t.post_id) || [];
      arr.push(t.name);
      tagsByPost.set(t.post_id, arr);
    }

    return rows.map((r) => ({
      id: r.id,
      authorId: r.author_id,
      author: {
        id: r.author_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      },
      title: r.title,
      content: r.content,
      status: r.status,
      likesCount: r.likes_count,
      commentsCount: r.comments_count,
      tags: tagsByPost.get(r.id) || [],
      media: [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async searchUsers(queryText: string, limit: number = 20): Promise<UserProfile[]> {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const pattern = `%${queryText.trim().toLowerCase()}%`;

    const profiles = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('profiles.username', 'ilike', pattern),
          eb('profiles.display_name', 'ilike', pattern),
          eb('profiles.bio', 'ilike', pattern),
        ])
      )
      .orderBy('profiles.followers_count', 'desc')
      .limit(safeLimit)
      .execute();

    return profiles.map((p) => ({
      userId: p.user_id,
      username: p.username,
      displayName: p.display_name,
      bio: p.bio,
      avatarUrl: p.avatar_url,
      coverUrl: p.cover_url,
      githubUrl: p.github_url,
      websiteUrl: p.website_url,
      followersCount: p.followers_count,
      followingCount: p.following_count,
      postsCount: p.posts_count,
      updatedAt: p.updated_at,
    }));
  }
}
